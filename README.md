### NFT Utils


Smol repo for updating NFTs:


# get

```
ts-node nftutil.ts get --mint_addr 62iYQXP1WCrKxwy5EWsXmso1uB3HuPECYBeh8wEo6veb --cluster devnet
ts-node nftutil.ts get --metadata_addr 7mpNHvoEGCj2H9mJsej9orCVtQpcN8wqzBB26aGw6f3g --cluster devnet
```

# create
only works for devnet currently...

```
ts-node nftutil.ts create --image_path test_nft/dead_head43.jpg --json_path test_nft/dead_head43.json --payer_keypair_path test_key.json --cluster devnet
```

# update

```
ts-node nftutil.ts update --nft_mints_file test_nft_mints.devnet.json --new_json_uri https://arweave.net/KtwKVI_d_5uV_UllZRe4tLViA5XqX_0r_jTfSXWeiW4 --cluster devnet
```