import Promise from "promise";
import { ipcRenderer } from "electron";
import { isString } from "util";
import { withLog as log, logOptionNoResponseData } from "./app";

export const checkcommanderuitonVersion = log(() => Promise
  .resolve(ipcRenderer.sendSync("check-version"))
  , "Check commanderuiton release version");

export const startDaemon = log((appData, testnet) => Promise
  .resolve(ipcRenderer.sendSync("start-daemon", appData, testnet))
  .then(pid => {
    if (pid) return pid;
    throw "Error starting daemon";
  }), "Start Daemon");

export const cleanShutdown = () => {
  return new Promise(resolve => {
    ipcRenderer.send("clean-shutdown");
    ipcRenderer.on("clean-shutdown-finished", (event, stopped) => {
      if(!stopped)
        throw "Error shutting down app";
      resolve(stopped);
    });
  });
};

export const createNewWallet = log((walletPath, testnet) => Promise
  .resolve(ipcRenderer.sendSync("create-wallet", walletPath, testnet))
  .then(pid => {
    if (pid) return pid;
    throw "Error creating wallet";
  }), "Create Wallet");

export const removeWallet = log((walletPath, testnet) => Promise
  .resolve(ipcRenderer.sendSync("remove-wallet", walletPath, testnet))
  .then(pid => {
    if (pid) return pid;
    throw "Error creating wallet";
  }), "Remove Wallet");

export const stopWallet = log(() => Promise
  .resolve(ipcRenderer.sendSync("stop-wallet"))
  .then(stopped => {
    return stopped;
  }), "Stop Wallet");

export const startWallet = log((walletPath, testnet) => new Promise((resolve, reject) => {
  let pid, port;

  // resolveCheck must be done both on the cdrwallet-port event and on the
  // return of the sendSync call because we can't be certain which will happen first
  const resolveCheck = () => pid && port ? resolve({ pid, port }) : null;

  ipcRenderer.once("cdrwallet-port", (e, p) => { port = p; resolveCheck(); });
  pid = ipcRenderer.sendSync("start-wallet", walletPath, testnet);
  if (!pid) reject("Error starting wallet");
  resolveCheck();
}), "Start Wallet");

export const setPreviousWallet = log((cfg) => Promise
  .resolve(ipcRenderer.sendSync("set-previous-wallet", cfg))
  , "Set Previous Wallet");

export const getPreviousWallet = log(() => Promise
  .resolve(ipcRenderer.sendSync("get-previous-wallet"))
  , "Get Previous Wallet", logOptionNoResponseData());

export const getBlockCount = log((rpcCreds, testnet) => new Promise(resolve => {
  ipcRenderer.once("check-daemon-response", (e, block) => {
    const blockCount = isString(block) ? parseInt(block.trim()) : block;
    resolve(blockCount);
  });
  ipcRenderer.send("check-daemon", rpcCreds, testnet);
}), "Get Block Count");

export const getcdrLogs = log(() => Promise
  .resolve(ipcRenderer.sendSync("get-cdr-logs"))
  .then(logs => {
    if (logs) return logs;
    throw "Error getting cdr logs";
  }), "Get cdr Logs", logOptionNoResponseData());

export const getcdrwalletLogs = log(() => Promise
  .resolve(ipcRenderer.sendSync("get-cdrwallet-logs"))
  .then(logs => {
    if (logs) return logs;
    throw "Error getting cdrwallet logs";
  }), "Get cdrwallet Logs", logOptionNoResponseData());

export const getcommanderuitonLogs = log(() => Promise
  .resolve(ipcRenderer.sendSync("get-commanderuiton-logs"))
  .then(logs => {
    if (logs) return logs;
    throw "Error getting commanderuiton logs";
  }), "Get commanderuiton Logs", logOptionNoResponseData());

export const getAvailableWallets = log((network) => Promise
  .resolve(ipcRenderer.sendSync("get-available-wallets", network))
  .then(availableWallets => {
    if (availableWallets) return availableWallets;
    throw "Error getting avaiable wallets logs";
  }), "Get Available Wallets", logOptionNoResponseData());

export const reloadAllowedExternalRequests = log(() => Promise
  .resolve(ipcRenderer.sendSync("reload-allowed-external-request"))
  , "Reload allowed external request");

export const allowStakePoolHost = log(host => Promise
  .resolve(ipcRenderer.sendSync("allow-stakepool-host", host))
  , "Allow StakePool Host");

export const getcdrLastLogLine = () => Promise
  .resolve(ipcRenderer.sendSync("get-last-log-line-cdr"));

export const getcdrwalletLastLogLine = () => Promise
  .resolve(ipcRenderer.sendSync("get-last-log-line-cdrwallet"));
