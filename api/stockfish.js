// api/stockfish.js

const stockfish = require("stockfish");
const path = require("path");

// This function wraps the asynchronous, event-based Stockfish engine
// into a Promise-based one, which is easier to use in an async/await context.
function runStockfishCommand(command) {
    return new Promise((resolve, reject) => {
        const engine = stockfish();
        let output = [];
        let bestMove = "";

        // The 'message' event is triggered whenever Stockfish sends output.
        engine.onmessage = function (line) {
            // console.log(`> ${line}`); // Uncomment for detailed logs
            output.push(line);

            // Stockfish signals it's ready for commands with "uciok".
            if (command === "uci" && line === "uciok") {
                engine.quit();
                resolve(output.join("\n"));
            }

            // For 'go' commands, the final output is the 'bestmove'.
            if (line.startsWith("bestmove")) {
                bestMove = line.split(" ")[1];
                engine.quit();
                // We resolve with the full output log for context.
                resolve(output.join("\n"));
            }
        };

        // Set a timeout to prevent the function from running indefinitely
        // if Stockfish doesn't respond as expected.
        setTimeout(() => {
            if (!bestMove && command.startsWith("go")) {
                engine.quit();
                reject(new Error("Stockfish timeout. Full log:\n" + output.join("\n")));
            }
        }, 20000); // 20-second timeout

        // Send the initial command to the engine.
        engine.postMessage(command);
    });
}

// This is the main Vercel serverless function handler.
export default async function handler(req, res) {
    // 1. Check for POST request
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    // 2. Extract command from JSON body
    const { cmd } = req.body;
    if (!cmd) {
        return res.status(400).json({ error: 'Missing "cmd" in request body.' });
    }

    try {
        // 3. Run the command and wait for the result
        console.log(`Executing Stockfish command: ${cmd}`);
        const stockfishOutput = await runStockfishCommand(cmd);

        // 4. Send the result back as a plain text response
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(stockfishOutput);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}