### NFT Utils


Smol repo for updating NFTs:

## Check for invalid NFTs

run:
```
cd /path/to/nftutils/
python -u nftfix.py validate --cmids cmids.txt --refresh
```

This creates a directory `./cmids` where it stores data on whether the nft metadata for nfts is valid or invalid


## Upload fixed metadata

```
ts-node nftutil.ts upload --file_path cmids/<cmid> --payer_keypath path/to/keypair.json --cluster [mainnet-beta|devnet]
```

## Update invalid nfts
```
ts-node nftutil.ts update --payer path/to/payerkeypair.json --update_authority path/to/update_authority.json --data_dir cmids/<cmid> --cluster [mainnet-beta|devnet]
```

Be sure to re-run nftfix.py with --refresh before the next run

TODO: make a single python command that refreshes and calls the other ts-node commands as needed