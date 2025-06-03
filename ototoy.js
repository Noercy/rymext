
(async function scrapeOtotoyJP() {
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
        console.log(rDate[2])
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
})();
