import * as dotenv from "dotenv";
import { providers, Wallet, utils, BigNumber, Contract } from "ethers";
import {
    FlashbotsBundleProvider,
    FlashbotsTransactionResponse,
    SimulationResponseSuccess,
} from "@flashbots/ethers-provider-bundle";
import IERC20_ABI from "./abi/IERC20.json";

dotenv.config();

const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const ERC20_TRANSFER_GAS = 100000; // TODO: estimate more accurately
const GAS_PRICE_MULTIPLIER = 3; // TODO: estimate more accurately
const GAS_PRICE = utils
    .parseUnits(process.env.BASE_GAS_PRICE!, 9)
    .mul(GAS_PRICE_MULTIPLIER); // TODO: use current gasprice from station

async function setup() {
    // Instantiate Ethers provider
    const provider = new providers.JsonRpcProvider(
        {
            url: RPC_URL,
        },
        1
    );

    // Instantiate gas tank & user wallets
    const userSigner = new Wallet(process.env.USER_PRIVATE_KEY!).connect(
        provider
    );
    const gasTankSigner = new Wallet(process.env.GAS_TANK_PRIVATE_KEY!).connect(
        provider
    );

    // Instantiate Flashbots provider
    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        gasTankSigner
    );

    return { provider, userSigner, gasTankSigner, flashbotsProvider };
}

async function getDepositTx(to: string) {
    const value = BigNumber.from(ERC20_TRANSFER_GAS).mul(GAS_PRICE);
    return {
        to: to,
        value: value,
        gasPrice: GAS_PRICE,
        gasLimit: 21000,
    };
}

async function getTransferTx(provider: providers.JsonRpcProvider) {
    const tokenContract = new Contract(
        process.env.TOKEN_ADDRESS!,
        IERC20_ABI,
        provider
    );

    const decimals = await tokenContract.decimals();
    const amount = utils.parseUnits(process.env.TRANSFER_AMOUNT!, decimals);

    const tx = await tokenContract.populateTransaction.transfer(
        process.env.RECIPIENT!,
        amount
    );
    return {
        ...tx,
        gasPrice: GAS_PRICE,
        gasLimit: ERC20_TRANSFER_GAS,
    };
}

async function main() {
    // Setup
    const { provider, userSigner, gasTankSigner, flashbotsProvider } =
        await setup();
    console.log("User wallet:", userSigner.address);
    console.log("Gas tank wallet:", gasTankSigner.address);

    // Get target block (+3 from current)
    const targetBlockNumber = (await provider.getBlockNumber()) + 3;
    console.log("Target block is:", targetBlockNumber);

    // Prepare bundle

    console.log("Preparing bundle...");

    const bundle = [
        {
            signer: gasTankSigner,
            transaction: await getDepositTx(userSigner.address),
        },
        { signer: userSigner, transaction: await getTransferTx(provider) },
    ];
    const signedTransactions = await flashbotsProvider.signBundle(bundle);

    console.log("Bundle prepared and signed");

    // Simulate bundle

    console.log("Simulating bundle...");

    const simulation = await flashbotsProvider.simulate(
        signedTransactions,
        targetBlockNumber
    );

    console.log("Simulation result:", JSON.stringify(simulation, null, 2));

    if ((simulation as SimulationResponseSuccess)?.firstRevert) {
        console.warn("Simulation failed, breaking");
        return;
    }

    // Send bundle

    console.log("Sending bundle...");

    const flashbotsTransactionResponse = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        targetBlockNumber
    );

    console.log(flashbotsTransactionResponse);

    const receipts = await (
        flashbotsTransactionResponse as FlashbotsTransactionResponse
    ).receipts();

    console.log(receipts);

    await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
