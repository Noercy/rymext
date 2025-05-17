
// get data from popup and send it ot the fillrym func
document.getElementById("submissionForm").addEventListener("submit", (e) => {
    const artistID = document.getElementById("artistID").value;
    const formattedID = artistID.replace(/\D/g, "");

    const releaseType = document.querySelector('input[name="release-type"]:checked').value;
    const title = document.getElementById("title").value;
    const catalorNr = document.getElementById("catalog-nr").value;
    const releaseDate = document.getElementById("release-date").value;
    const label = document.getElementById("label").value;
    const trackList = document.getElementById("tracklist").value;
    const credits = JSON.parse(document.getElementById("creditlist").value)
    const languages = document.getElementById("langInput").value;
    const source = document.getElementById('source-url').value;

    chrome.tabs.create({ url :`https://rateyourmusic.com/releases/ac?artist_id=${formattedID}`}, (tab) => {
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: fillRYM,
            args: [releaseType, title, catalorNr, releaseDate, label, trackList, credits, languages, source],
        })
    })
});

// Different scrape logic depending on current url --- TODO hide rest of popup until btn is pressed
document.getElementById("autoFill").addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    const popupInputs = document.getElementById("hiddenGuy");
    popupInputs.style.display = "flex";

    const currUrl = tab.url;
    console.log("Current URL:", currUrl);

    if (currUrl.includes("https://ototoy.jp/_/default/")) {
        console.log("We are now in ototoy land, time to scrape baby:", currUrl);
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeOtotoyJP,
            args: [currUrl],
        });
    };
});

function scrapeOtotoyJP(currUrl) {
    let title = document.querySelector(".album-title")?.textContent;
    chrome.runtime.sendMessage({ type: "SET_TITLE", payload: title });

    const catalogNr = document.querySelector(".catalog-id");
    if (catalogNr) {
        match = catalogNr.textContent.match(/Catalog number:\s*([A-Z0-9\-]+)/);
        if (match) {
            const cr = match[1];
            chrome.runtime.sendMessage({ type: "SET_CATALOGNR", payload: cr });
        } else {
            console.log("Weird catalog number")
        }
    }

    const releaseDates = document.querySelectorAll(".release-day")
    if (releaseDates.length > 1 ) {
        rDate = releaseDates[1].textContent.match(/Original release date:\s*([A-Z0-9\-]+)/);
        chrome.runtime.sendMessage({ type: "SET_RELEASEDATE", payload: rDate[1] })
        console.log(rDate[1]);
    } else {
        rDate = releaseDates[0].textContent.match(/(Original\s)?Release date:\s*([A-Z0-9\-]+)/i)
        chrome.runtime.sendMessage({ type: "SET_RELEASEDATE", payload: rDate[2] })
        console.log(rDate[1])
    }

    const label = document.querySelector(".label-name a");
    if (label) {
        const labelName = label.textContent
        console.log(label)
        chrome.runtime.sendMessage({ type: "SET_LABEL", payload: labelName })
    }

    // This is doing too many things dealing with the tracklist, feature artists and disc count
    let advTrackList = "";
    let creditList = [];
    let trackNr = 0;
    let diskNr = 0;
    let isMultiCD = false;
    const trackTbody = document.getElementById("tracklist").getElementsByTagName("tbody")[0]
    const rows = Array.from(trackTbody.rows).slice(1);

    for (const tRow of rows) {
        if(tRow.cells[0].textContent.match(/DISC/))
        {
            isMultiCD = true
            trackNr = 0;
            diskNr = tRow.cells[0].textContent.slice(-1);

        } else {
            trackNr++;
            const cell1 = tRow.cells[1]; // trackname cell
            const cell2 = tRow.cells[2]; // song duration cell
            const trackMetadata = cell1.querySelectorAll("span");
        
            let trackName = trackMetadata[0].textContent.trim();
            const trackNameFt = trackName.match(/\(([^)]*?\b(feat|ft)\b[^)]*?)\)/i);
            if (trackNameFt) {  // clean trackname from "feat" and add features in a seperate array
                const ftArtistRaw = trackNameFt[1].replace(/(?:feat\.?|ft\.?)\s*/i, "");
                console.log(ftArtistRaw)

                let ftArtistsArray;
                if (ftArtistRaw.includes(",") || ftArtistRaw.trim().split(/\s+/).length > 1) {
                    ftArtistsArray = ftArtistRaw.split(/\s*,\s*/); // multiple ft
                    console.log(ftArtistsArray)
                } else {
                    ftArtistsArray = [ftArtistRaw.trim()] // single ft
                    console.log(ftArtistsArray)
                }

                const role = "featured"
                for (const name of ftArtistsArray) {
                    featEntry = [`${name}`, `${role}`, `${trackNr}`] 
                    creditList.push(featEntry);
                    console.log(featEntry);
                }
                console.log("Final credit list: ", creditList)
                
                trackName = trackName.replace(trackNameFt[0], "").trim(); // replace the feat in title
                console.log(trackName)
                console.log(trackNr)
            }  
            if (trackMetadata.length > 2 ) {
                const mainArtist = document.querySelector('.album-artist a').textContent.trim();
                const collabArtists = trackMetadata[1].querySelectorAll('a');
                const role = "with";

                for (let name of collabArtists) {
                    name = name.textContent.trim()
                    if (name === mainArtist) {
                        continue;
                    } else {
                        const duplicateCheck = creditList.some(entry => entry[0] === name && parseInt(entry[2]) === trackNr);
                        if (!duplicateCheck) {
                            featEntry = [`${name}`, `${role}`, `${trackNr}`] ;
                            creditList.push(featEntry);
                        }
                    }
                }
            }
            
            const duration = cell2.textContent.trim();
            const fullTrNr = isMultiCD ? `${diskNr}.${trackNr}` : `${trackNr}`; 
    
            advTrackList += `${fullTrNr}|${trackName}|${duration}\n`
        }
    }
    chrome.runtime.sendMessage({ type: "SET_TRACKLIST", payload: advTrackList })
    chrome.runtime.sendMessage({ type: "SET_CREDITS", payload: creditList })
    console.log(advTrackList)
    console.log(creditList) 

    chrome.runtime.sendMessage({ type: "SET_SOURCE", payload: currUrl})

    const enlargeImg = document.querySelector('button[name="artwork-modal"]')
    enlargeImg.click();
    const albumCover = document.querySelector('a[class="oty-btn-login"]')
    const imgUrl = albumCover.href;
    const imgName = title += ".jpg" 
    console.log("download start")
    console.log("the name of the file should be: ", imgName)
    setTimeout(() => {
        chrome.runtime.sendMessage({ type: "DOWNLOAD_IMAGE", url: imgUrl, filename: imgName });
    }, 500)
}

// to populate the popup lil api guy
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SET_TITLE") {
        const input = document.getElementById("title");
        if (input) {
            input.value = message.payload;
        }
    }
    if (message.type === "SET_RELEASEDATE") {
        const input = document.getElementById("release-date");
        if (input) {
            input.value = message.payload;
        }
    }
    if (message.type === "SET_LABEL") {
        const input = document.getElementById("label");
        if (input) {
            input.value = message.payload;
        }
    }
    if (message.type === "SET_CATALOGNR") {
        const input = document.getElementById("catalog-nr");
        if (input) {
            input.value = message.payload;
        }
    }
    if (message.type === "SET_TRACKLIST") {
        const input = document.getElementById("tracklist");
        if (input) {
            input.value = message.payload;
        }
    }
    if (message.type === "SET_CREDITS") {
        const input = document.getElementById("creditlist");
        console.log("in message payload")
        console.log(message.payload)
        if (message.payload.length > 0) {
            input.style.display = "block";
            input.value = JSON.stringify(message.payload);
        }
    }
    if (message.type === "SET_SOURCE") {
        const input = document.getElementById("source-url");
        if (input) {
            input.value = message.payload;
        }
    }
    if (message.type === "DOWNLOAD_IMAGE") {
        const toDlCover = document.getElementById('dlImg').checked;
        if (toDlCover) {
            chrome.downloads.download({
                url: message.url,
                filename: message.filename,
                saveAs: false
            })
            console.log("download done")
        } else {
            console.log("Not downloading cover")
        }
    }
})

// for filling in the rym form on the site
function fillRYM(releaseType, title, catalogNr, releaseDate, label, trackList, creditList, languages, source) {
    const tryFill = async () => {
        const releaseTypeEPInput = document.querySelector('input[id="categorye"]')
        const releaseTypeSingleInput = document.querySelector('input[id="categoryi"]')
        const titleInput = document.querySelector('input[name="title"]');
        const catalogInput = document.querySelector('input[name="catalog_no"]');
        const monthSelect = document.querySelector('select[name="month"]');
        const daySelect = document.querySelector('select[name="day"]');
        const yearSelect = document.querySelector('select[name="year"]');
        const labelSelect = document.querySelector('input[id="searchterm"]'); 
        // const cdFormatInput = document.querySelector('input[id="format60"]');
        const digitalFormatInput = document.querySelector('input[id="format58"]');
        const digitalDistFile = document.querySelector('input[name="attrib122"]');
        // const digitalDistStream = document.querySelector('input[name="attrib123"]');
        const langInput = document.querySelector('input[name="languages"]');
        const sourceInput = document.querySelector('textarea[id="notes"]');

        const releaseArr = releaseDate.match(/\d+/g); // split date string into array of 3 ex.[2010, 08, 12]

        if (titleInput) {
            titleInput.value = title;
            catalogInput.value = catalogNr;
            labelSelect.value = label;

            yearSelect.value = releaseArr[0];
            monthSelect.value = releaseArr[1];
            daySelect.value = releaseArr[2];

            langInput.value = languages;
            sourceInput.value = source;

            console.log("Title filled:", title);
            console.log("Catalog number filled:", catalogNr.value);
            console.log("Release date filled: ", releaseArr);

            const addLabelButton = document.querySelector('input[onclick="searchLabels();"]');
            addLabelButton.click(); // do the same as with credits checking names 
            console.log("The label: ", addLabelButton); // still needs to be selected by hand since its not definite that the label exists in the db

            const creditsInput = document.querySelector('input[name="credit_searchterm"]');
            const searchCreditsButton = document.querySelector('input[onclick="searchCredits();"]');
            
            let tempcount = 0;
            for (let creditEntry of creditList) {
                tempcount++;
                console.log(creditEntry[0]);
                const creditEntryName = creditEntry[0];
                const creditRole = creditEntry[1];
                const creditTrackNr = creditEntry[2];
                creditsInput.value = creditEntryName;
                searchCreditsButton.click();
            
                await sleep(2000);
                
                const creditIframe = document.querySelector('iframe[name="creditlist"]');
                const targetBody = creditIframe.contentDocument.body;
                const firstCreditRes = targetBody.querySelector('div[class="result"]');
                
                if (firstCreditRes) {
                    const creditInfo = firstCreditRes.querySelector('.info b');
                    const creditSearchRes = creditInfo.textContent.trim();
                    if (creditEntryName === creditSearchRes) {
                        console.log("The credited artist is matching")
                        firstCreditRes.click();
                    } else {
                        console.warn("The credited artist may be wrong - Take precaution")
                        firstCreditRes.click();

                        const warningDiv = document.createElement('div');
                        const warningSymbol = document.createTextNode('!');
                        const warningCont = document.createElement('div');
                        const artistSpan = document.createElement('span');
                        artistSpan.textContent = creditEntryName;
                        artistSpan.style.textDecoration = 'bold';
                        artistSpan.style.color = 'rgb(238, 191, 191)';
                        artistSpan.style.fontSize = '1.5em';
                        artistSpan.style.margin = '0 4px';

                        warningCont.style.color = 'rgb(255, 107, 107)';
                        warningCont.style.verticalAlign = 'middle';
                        warningCont.style.padding = 'inherit';
                        warningCont.append('The credited artist', artistSpan, 'may be incorrect - Double-check manually!'); 

                        warningDiv.style.width = '5rem';
                        warningDiv.style.height = '1rem';
                        warningDiv.style.textAlign = 'center';
                        warningDiv.style.verticalAlign = 'middle';
                        warningDiv.style.border = 'solid rgb(134, 113, 13)';
                        warningDiv.style.backgroundColor = 'rgb(70, 60, 7)';
                        warningDiv.style.fontSize = 'xx-large';
                        warningDiv.style.cursor = 'help';
                        warningDiv.title = 'The credited artist may be incorrect - Double-check manually!'
                        warningDiv.appendChild(warningSymbol);

                        const badCreditRow = document.getElementById(`credits_${tempcount}`);
                        badCreditRow.appendChild(warningDiv);
                        badCreditRow.appendChild(warningCont);
                    }
                    
                    const roleInput = document.querySelector(`input[name="credits_roles_${tempcount}"]`)
                    const trackNrInput = document.querySelector(`input[name="credits_tracks_${tempcount}"]`)
                    roleInput.value = creditRole;
                    trackNrInput.value = creditTrackNr;

                    console.log("Feature credit added successfully");
                } else {
                    console.log("Credits could not be added");
                }
            }
          
            if (releaseType === "ep") {
                releaseTypeEPInput.checked = true; 
            } else if (releaseType === "single") {
                releaseTypeSingleInput.checked = true;
            }
            
            // TODO: This isnt always true, stick to only digital
            /*
            if (catalogInput.value) {
                cdFormatInput.checked = true;
            } else {
                console.log("we are digital")
                digitalFormatInput.checked = true;
                digitalDistFile.checked = true; 
                digitalDistStream.checked = true;
            } 
            */
            // Only digital form
            digitalFormatInput.checked = true;
            digitalDistFile.checked = true; 
            
        } else {
            console.log("Input not found, retrying...");
            setTimeout(tryFill, 500);
        }
    };

    const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms)); } 

    // fill in tracklist a little later to let it load in
    const tryTrackFill = () => {
        const trackListInput = document.querySelector('textarea#track_advanced');
        const smplBtn = document.getElementById("goSimpleBtn"); // wait until filled to switch back

        if (trackListInput) {
            trackListInput.value = trackList;
            console.log("Tracklist filled:", trackList);
            smplBtn.click();
            console.log("Simple button pressed")
        }
    }

    // switch to advanced tracklisting
    const pressRYMbtn = () => {
        const advBtn = document.getElementById("goAdvancedBtn");
        
        if (advBtn) { 
            console.log("Button found");
            advBtn.click();
            setTimeout(tryFill, 500); 
            setTimeout(tryTrackFill, 500);
        } else {
            console.log("Button not found");
            setTimeout(pressRYMbtn, 500);
        }
    }
    pressRYMbtn();
}

//  TODO Save standard
// logic for the popup langauge select
const languages = ["English", "Spanish", "French", "Japanese", "German", "Italian", "Portuguese", "Chinese",  "Russian", "Arabic"];

const datalist = document.getElementById("languages");
languages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    datalist.appendChild(option);
})

const langInput = document.getElementById("langInput");
const savedLang = localStorage.getItem("preferredLanguage");
if (savedLang) {
    langInput.value = savedLang;
}

langInput.addEventListener("change", () => {
    const selectedLang = langInput.value;
    localStorage.setItem("preferredLanguage", selectedLang);
    console.log("Preferred language saved:", selectedLang);
})

const clearLang = document.getElementById("langClear");
clearLang.addEventListener("click", () => {
    localStorage.clear();
    console.log("Preferred langauge cleared")
})