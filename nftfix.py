import argparse
import subprocess
import sys
import urllib.request
import json
import time
import random
import os
from pathlib import Path

from importlib_metadata import metadata

HOLAPLEX_INDEXER_POSTGRES_URL = str(os.environ.get("HOLAPLEX_INDEXER_POSTGRES_URL"))

# Fetch an nft metadata json with retry
def fetch_nft_metadata(nft_url, max_retries=16):
    retry_count = 0
    max_delay = 32 # 32 seconds

    user_agent_header = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
    }

    metadata_json = None

    while retry_count < max_retries:
        if retry_count > 0:
            delay_seconds = min(max_delay, pow(2, retry_count) / 1000) + random.uniform(0, 1)
            print(f"Retry Attempt: {retry_count} Backing off: {delay_seconds}")
            time.sleep(delay_seconds)
        retry_count += 1
        try:
            req = urllib.request.Request(nft_url, data=None, headers=user_agent_header)
            with urllib.request.urlopen(req, timeout=10) as f:
                metadata = f.read().decode('utf-8')
            
            metadata_json = json.loads(metadata)
            return metadata_json
        except Exception as e:
            print(f"Request for {nft_url} failed: {e}")

    return metadata_json

# Fetch all the nft's minted by the candy machine id
def fetch_nft_mint_ids(cmid: str) -> list:
    query = f"""\
copy (\
select metadatas.mint_address, metadatas.uri \
from candy_machines \
inner join candy_machine_collection_pdas on candy_machine_collection_pdas.candy_machine = candy_machines.address \
inner join metadata_collection_keys on metadata_collection_keys.collection_address = candy_machine_collection_pdas.mint \
inner join metadatas on metadatas.address = metadata_collection_keys.metadata_address \
left join current_metadata_owners on metadatas.mint_address = current_metadata_owners.mint_address \
where candy_machines.address = '{cmid}') \
to stdout csv;"""

    result = subprocess.check_output(["psql", HOLAPLEX_INDEXER_POSTGRES_URL, "-c", query]).decode(sys.stdout.encoding)
    lines = str(result).split("\n")[:-1]
    lines = list(map(lambda line: line.replace(" ", "").split(","), lines))
    return lines

# Check if json metadata is malformed
def metadata_is_malformed(metadata_json) -> bool:
    files = metadata_json["properties"]["files"]
    for file in files:
        if not str(file["uri"]).startswith("http"):
            return True

    return False

# NOTE: modifies metadata_json and returns it
def fix_metadata(metadata_json) -> dict:
    files = list()

    image_uri = metadata_json.get("image", None)
    if image_uri:
        files.append({
            "uri": image_uri,
            "type": "image/jpeg"
        })

        is_jpeg = str(image_uri).endswith("jpg") or str(image_uri).endswith("jpeg")
        if not is_jpeg:
            print(f"non jpeg image uri {image_uri}")

    animation_uri = metadata_json.get("animation_url", None)
    if animation_uri:
        files.append({
            "uri": animation_uri,
            "type": "video/mp4"
        })

        is_mp4 = str(animation_uri).endswith("mp4")
        if not is_mp4:
            print(f"non mp4 animation uri {animation_uri}")

    metadata_json["properties"]["files"] = files

    return metadata_json

# Some of the urls are slow, replace the slow ones with hola proxy urls
def get_hola_proxy_url(asset_url: str) -> str:
    # asset url examples:
    # https://bafkreidrno3ro4eqrq7hzunifprgy2hcxjwp5t7vcbpnl6a7ifncvxs5ni.ipfs.dweb.link?ext=jpg

    # proxy url example:
    # https://assets.holaplex.tools/ipfs/bafkreidm7lzqhiumwf67xf7ubq74szgmxb77cydyjradgkmciat53g4oqe

    if asset_url.find("ipfs.dweb.link") >= 0:
        cid = asset_url.removeprefix("http://").removeprefix("https://").split(".")[0]
        return f"https://assets.holaplex.tools/ipfs/{cid}"
    
    return asset_url

# 1. load a file containing a list of cmids
# 2. fetch all the nft's minted by that candy machine
# 3. persist info about the on chain state of the nfts
def validate(args):
    with open(args.cmids, 'r') as file:
        cmids = file.read().split("\n")

    CMIDS_DATA_DIR = Path("./cmids")

    bad_cmids = set()
    bad_nft_mints = list()

    for cmid in cmids:
        if cmid.startswith("#"):
            continue

        # locations for data from previous runs
        cmid_dir = CMIDS_DATA_DIR / cmid
        cmid_dir.mkdir(parents=True, exist_ok=True)
        metadata_file = cmid_dir/ "metadata.json"

        print(f"Validating Candy Machine {cmid}")
        mint_infos = fetch_nft_mint_ids(cmid=cmid)
        for [mint_id, metadata_url] in mint_infos:
            mint_id_file = cmid_dir / mint_id
            if mint_id_file.exists() and not args.refresh:
                continue

            maybe_proxy_url = get_hola_proxy_url(asset_url=metadata_url)
            metadata = fetch_nft_metadata(maybe_proxy_url)
            

            if metadata_is_malformed(metadata_json=metadata): 
                bad_nft_mints.append((mint_id, maybe_proxy_url))               
                with open(mint_id_file, "w") as mint_file:
                    mint_file.write("invalid")

                fixed_metadata = fix_metadata(metadata)

                if not metadata_file.exists() or args.refresh:
                    bad_cmids.add(cmid)
                    with open(metadata_file, 'w') as f:
                        json.dump(fixed_metadata, f)
                else:
                    with open(metadata_file, 'r') as f:
                        existing_meta = json.load(f)
                        if fixed_metadata != existing_meta:
                            print("fixed metadata is different from existing metadata")
                            print(f"fixed: {fixed_metadata}")
                            print(f"existing: {existing_meta}")
            else:
                with open(mint_id_file, "w") as mint_file:
                    mint_file.write("valid")

    print(f"Found {len(bad_nft_mints)} bad nfts across {len(list(bad_cmids))} candy machines (since previous run)")

    summary_path = f"./summary_{time.time_ns()}"
    print(f"Saving Summary to: {summary_path}")
    with open(summary_path, "w") as f:
        f.write("Bad cmids:\n")
        f.write(f"{list(bad_cmids)}\n")
        f.write(f"Bad nft mints:\n")
        f.write(f"{bad_nft_mints}")

    print("Done!")


def upload(args):
    cmids_path = Path("./cmids")
    for dir in cmids_path.iterdir():
        if not os.path.isdir(dir):
            continue

        metadata_path = dir / "metadata.json"
        metadata_upload_stamp = dir / f"metadata.json.upload.{args.cluster}"

        if metadata_path.exists() and not metadata_upload_stamp.exists():
            print(f"Uploading: {metadata_path}")
            command = [
                "ts-node", "nftutil.ts", "upload", 
                "--file_path", str(metadata_path),
                "--payer_keypath", args.payer,
                "--cluster", args.cluster,
            ]
            subprocess.check_call(command)

def update(args):
    cmids_path = Path("./cmids")
    for dir in cmids_path.iterdir():
        if not os.path.isdir(dir):
            continue
        
        metadata_path = dir / "metadata.json"
        metadata_upload_stamp = dir / f"metadata.json.upload.{args.cluster}"

        if not metadata_upload_stamp.exists():
            # print(f"nothing to do for: {dir}")
            continue

        with open(metadata_upload_stamp) as f:
            metadata_fixed_url = f.read()

        command = [
            "ts-node", "nftutil.ts", "update",
            "--payer", args.payer,
            "--update_authority", args.payer,
            "--data_dir", str(dir),
            "cluster", args.cluster
        ]
        print(metadata_fixed_url)
        print(command)
        # subprocess.check_call(command)

def runall(args):
    args.__setattr__("refresh", True) 
    validate(args)
    upload(args)
    update(args)
                        
def main():
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers(help="sub-command help", dest="subparser_name")

    validate_parser = subparsers.add_parser("validate", help="")
    validate_parser.add_argument("--cmids", help="Path to a file containing list of candy machine ids separate by newlines")
    validate_parser.add_argument("--refresh", action="store_true", help="if this flag is present, ignore local state and re-fetch and check all metadatas")
    validate_parser.set_defaults(func=validate)

    upload_parser = subparsers.add_parser("upload", help="upload nft metadatas that need to be uploaded in cmids directory")
    upload_parser.add_argument("--cluster", choices=["mainnet-beta", "devnet"], default="devnet", help="cluster name (mainnet-beta or devnet)")
    upload_parser.add_argument("--payer", help="path to keypair that will pay for the upload")
    upload_parser.set_defaults(func=upload)

    update_parser = subparsers.add_parser("update", help="update nft metadatas using the output from cmids directory")
    update_parser.add_argument("--cluster", choices=["mainnet-beta", "devnet"], default="devnet", help="cluster name (mainnet-beta or devnet)")
    update_parser.add_argument("--payer", help="path to keypair that will pay for the upload")
    update_parser.add_argument("--update_authority", help="path to keypair that is the update authority for the nft")
    update_parser.set_defaults(func=update)

    runall_parser = subparsers.add_parser("runall", help="run a full update cycle (validate -> upload -> update)")
    runall_parser.add_argument("--cmids", help="path to text file containing list of candy machine pubkeys separated by newlines")
    runall_parser.add_argument("--cluster", choices=["mainnet-beta", "devnet"], default="devnet", help="cluster name (mainnet-beta or devnet)")
    runall_parser.add_argument("--payer", help="path to keypair that will pay for the upload")
    runall_parser.add_argument("--update_authority", help="path to keypair that is the update authority for the nft")
    runall_parser.set_defaults(func=runall)
 
    args = parser.parse_args()

    if args.subparser_name:
        print(f"Command: {args.subparser_name} \n   args: {args}")
        args.func(args)
    else:
        print("No args")
        parser.print_help()
    
if __name__ == "__main__":
    main()