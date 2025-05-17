/*
let latestUrl = "";

// track everytime a new tab is switched to  // this isnt supported anymore for launch
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        const currUrl = tab.url;
        latestUrl = currUrl;
        console.log("Current URL:", currUrl);
    });
});

// send the latest current active tab to popup
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup") {
        port.postMessage({ type: "SEND_URL", payload: latestUrl });
        console.log("Sending URL to popup:", latestUrl);
    }
})
    */