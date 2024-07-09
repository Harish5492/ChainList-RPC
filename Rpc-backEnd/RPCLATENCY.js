const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

const fetcher = async (url) => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data from ${url}: ${error.message}`);
        throw error;
    }
};

const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: ["latest", false],
    id: 1,
});

const fetchChain = async (baseURL) => {
    if (!baseURL || baseURL.includes("API_KEY")) return null;
    try {
        let API = axios.create({
            baseURL,
            headers: {
                "Content-Type": "application/json",
            },
        });

        API.interceptors.request.use(function (request) {
            request.requestStart = Date.now();
            return request;
        });

        API.interceptors.response.use(
            function (response) {
                response.latency = Date.now() - response.config.requestStart;
                return response;
            },
            function (error) {
                if (error.response) {
                    error.response.latency = null;
                }
                return Promise.reject(error);
            },
        );

        let { data, latency } = await API.post("", rpcBody);

        return { ...data, latency };
    } catch (error) {
        console.error(`Error accessing ${baseURL}: ${error.message}`);
        throw error;
    }
};

const fetchWssChain = async (baseURL) => {
    if (!baseURL) return null;
    try {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(baseURL);
            let requestStart;

            socket.onopen = function () {
                socket.send(rpcBody);
                requestStart = Date.now();
            };

            socket.onmessage = function (event) {
                const data = JSON.parse(event.data);
                const latency = Date.now() - requestStart;
                resolve({ ...data, latency });
            };

            socket.onerror = function (e) {
                reject(e);
            };

            socket.onclose = function () {
                reject(new Error(`Socket closed prematurely for ${baseURL}`));
            };
        });
    } catch (error) {
        console.error(`Error accessing ${baseURL}: ${error.message}`);
        throw error;
    }
};

const populateChain = (chain, chainTvls) => {
    const chainTvl = chainTvls.find(tvl => tvl.chainId === chain.chainId);
    return {
        ...chain,
        tvl: chainTvl ? chainTvl.tvl : 0
    };
};

const overwrittenChains = [
    // Your overwritten chain data here
];

const generateChainData = async (chainId) => {
    try {
        const chains = await fetcher("https://chainid.network/chains.json");
        const chainTvls = await fetcher("https://api.llama.fi/chains");

        const overwrittenIds = overwrittenChains.reduce((acc, curr) => {
            acc[curr.chainId] = true;
            return acc;
        }, {});

        const filteredChains = chains
            .filter(c => c.status !== "deprecated" && (c.chainId === chainId || overwrittenIds[c.chainId]))
            .concat(overwrittenChains)
            .map(chain => populateChain(chain, chainTvls))
            .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));

        return filteredChains;
    } catch (error) {
        console.error('Error generating chain data:', error);
        throw error;
    }
};

app.get('/rpcbychainId/:chainId', async (req, res) => {
    const { chainId } = req.params;

    if (!chainId) {
        return res.status(400).json({ error: 'Chain ID parameter is required.' });
    }

    try {
        const chainsData = await generateChainData(parseInt(chainId));
        const urls = chainsData.flatMap(chain => chain.rpc);
        const name = chainsData[0].name;
        const rpcData = await checkLatencies(urls);

        rpcData.sort((a, b) => a.latency - b.latency);

        res.json({ rpcData, name });
    } catch (error) {
        console.error('Error fetching RPC data:', error);
        res.status(500).json({ error: 'Failed to fetch RPC data.' });
    }
});

const checkLatencies = async (urls) => {
    const results = await Promise.all(
        urls.map(async (url) => {
            if (!url) return null;
            try {
                const data = url.includes('wss://') ? await fetchWssChain(url) : await fetchChain(url);
                return formatData(url, data);
            } catch (error) {
                console.error(`Error checking latency for ${url}:`, error.message);
                return null;
            }
        })
    );
    return results.filter(result => result !== null);
};

const formatData = (url, data) => {
    let height = data?.result?.number ?? null;
    let latency = data?.latency ?? null;
    if (height) {
        const hexString = height.toString(16);
        height = parseInt(hexString, 16);
    } else {
        latency = null;
    }
    return { url, height, latency };
};

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
