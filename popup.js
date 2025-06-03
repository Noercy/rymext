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

// Different scrape logic depending on current url --
document.getElementById("autoFill").addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    const popupInputs = document.getElementById("hiddenGuy");
    popupInputs.style.display = "flex";

    const currUrl = tab.url;
    console.log("Current URL:", currUrl);
    const input = document.getElementById("source-url");
    input.value = currUrl

    // Can now create new files for each new site and scraper
    if (currUrl.includes("https://ototoy.jp/_/default/")) {
        console.log("We are now in ototoy land, time to scrape baby:", currUrl);
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['ototoy.js']
        });
    };
});

// Listener to populate the popup lil api guy, scraper function sends messages here
chrome.runtime.onMessage.addListener((message) => {
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
    if (message.type === "DOWNLOAD_IMAGE") {
        const toDlCover = document.getElementById('dlImg').checked;
        if (toDlCover) {
            chrome.downloads.download({
                url: message.url,
                filename: message.filename,
                saveAs: false
            })
            console.log("Download done")
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