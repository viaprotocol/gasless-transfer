# EVM Gasless Transfers

This repository contains sample code for execution of "gasless" ERC-20 transfers. It makes use of Flashbots, sending bundles of two consecutive transactions: deposit transaction from special gas tank account to user account, and second transaction with actual ERC-20 transfer. Flashbots will ensure that both transaction are executed at the same time.

## How to use

0. Make sure that you have Node.js and Yarn installed.

1. Install dependencies by running:

```
yarn
```

2. Copy `example.env` and rename it to `.env`. Then fill variables with actual values:

`ALCHEMY_API_KEY` - your Alchemy.com API key
`GAS_TANK_PRIVATE_KEY` - private key of gas tank account (should have ETH on balance)
`USER_PRIVATE_KEY` - private key of user account
`TOKEN_ADDRESS` - address of the ERC-20 token being transferred
`RECIPIENT` - address of the transfer recipient
`TRANSFER_AMOUNT` - amount of transfer in full units
`BASE_GAS_PRICE` - current gas price in gwei

3. Execute transfer by running:

```
npm run start
```

4. Wait for a minute, then check user's account Etherscan page for transactions
