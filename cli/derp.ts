import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { TextEncoder } from 'util';
import fs from 'fs/promises';
import { gql } from 'graphql-request';

import { graphQLClient } from './lib/graphql/client.js';
import { Keypair } from "@solana/web3.js"

import * as actualfs from 'fs'

const getNaCLKeyPair = async (fileName: string) => {
  let publicKeyB58: string;
  let privateKeyB58: string;

  const keyFileExists = await fileExists(fileName);

  if (!keyFileExists) {
    const keyPair = nacl.box.keyPair();
    publicKeyB58 = bs58.encode(keyPair.publicKey);
    privateKeyB58 = bs58.encode(keyPair.secretKey);
    await fs.writeFile(
      './key.json',
      JSON.stringify({
        publicKey: publicKeyB58,
        privateKey: privateKeyB58,
      }),
    );
  } else {
    const keyFile = JSON.parse(await fs.readFile(fileName, 'utf8'));
    publicKeyB58 = keyFile.publicKey;
    privateKeyB58 = keyFile.privateKey;
  }
  return {
    publicKeyB58,
    privateKeyB58,
  };
};

const fileExists = async (file: string) =>
  fs
    .stat(file)
    .then(() => true)
    .catch(() => false);

const encryptPayload = (
  payload: string,
  peerPublicKeyB58: string,
  myPrivateKeyB58: string,
) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(
    new TextEncoder().encode(payload),
    nonce,
    bs58.decode(peerPublicKeyB58),
    bs58.decode(myPrivateKeyB58),
  );
  return {
    nonce: bs58.encode(nonce),
    box: bs58.encode(box),
  };
};

const boxKeyFile = async ({
  peerPublicKeyB58,
  keyFilePath,
}: {
  peerPublicKeyB58: string;
  keyFilePath: string;
}) => {
  const solanaKeyFileContents = await fs.readFile(keyFilePath, 'utf8');
  const keyPair = await getNaCLKeyPair('./key.json');
  const boxedMessage = encryptPayload(
    solanaKeyFileContents,
    peerPublicKeyB58,
    keyPair.privateKeyB58,
  );
  return {
    box: boxedMessage.box,
    nonce: boxedMessage.nonce,
    clientPublicKey: keyPair.publicKeyB58,
  };
};

const loadKeyFromPath = (keyPath: string): Keypair => {
  const data = actualfs.readFileSync(keyPath, 'utf8');
  const dataJson = JSON.parse(data);
  return Keypair.fromSecretKey(Uint8Array.from(dataJson));
}

const testKey = loadKeyFromPath("./test-key.json")

const { box, clientPublicKey, nonce } = await boxKeyFile({
  peerPublicKeyB58: '4tieZ9Pst1TRUeCpeNeaXgraNbZSLnKrzgPJjeRVMsgj',
  keyFilePath: './FTRY1THFYyV8tBV39aiRkdx8xNYvLiEr4xB8k4R8u4op.json',
});

const configJSON = JSON.parse(await fs.readFile('./config.json', 'utf8'));
const zipFileUrl =
  'https://github.com/kevinrodriguez-io/stash/raw/master/assets.zip';
const env = 'devnet';
const rpc =
  'https://autumn-falling-bush.solana-devnet.quiknode.pro/d780e0b6a44a10fbe4982403eb88b4e58cfaa78a/';
const collection = 'J9JByPaQD6JNBHm25uNCtw6XjqnbgnfMYU7Tw6b7ts7t';
const setCollectionMint = true;

const result = await graphQLClient.request(
  gql`
    mutation createCandyMachine(
      $config: JSON!
      $filesZipUrl: String!
      $encryptedKeypair: EncryptedMessage!
      $env: String!
      $rpc: String!
      $collectionMint: String!
      $setCollectionMint: Boolean!
    ) {
      candyMachineUpload(
        config: $config
        filesZipUrl: $filesZipUrl
        encryptedKeypair: $encryptedKeypair
        env: $env
        rpc: $rpc
        collectionMint: $collectionMint
        setCollectionMint: $setCollectionMint
      ) {
        processId
      }
    }
  `,
  {
    config: configJSON,
    filesZipUrl: zipFileUrl,
    encryptedKeypair: {
      boxedMessage: box,
      nonce: nonce,
      clientPublicKey: clientPublicKey,
    },
    env: env,
    rpc: rpc,
    collectionMint: collection,
    setCollectionMint: setCollectionMint,
  },
);

console.log(result);
