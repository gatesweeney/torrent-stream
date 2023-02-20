// API Caller and processor

import play from "./play.js";

export async function fetchTorrents(query, domain, port, site, limit, seedMin, searchAll) {
    
    $('#lottie').css("display", "block");
    
    //set default api type
    var apiType;

    if (searchAll === true) {  apiType = '/api/v1/all/search?'; site = '';  }
    else {  apiType = '/api/v1/search?site=';  }
    console.log(apiType);


    // Log movie currently being queried
    console.log(`-------------      FINDING MOVIE       --------\n${query}`);
    // Remove special characters and URLify the query with %20
    query = query.replace(/[^a-zA-Z0-9 ]/g, '');
    query = query.replaceAll(' ', '%20');
    // URL structure
    var url = `http://${domain}:${port}${apiType}${site}&query=${query}&limit=${limit}`
    // store urls for debug only
    console.log(url);    
    
    // API Call
    await $.getJSON(url, async function (req) {

            let linkTitle;
            var magnet = '#';
            var seedColor = '#f2f0cd';
            
            var big = 0;
            var largestID = null;
            var listings = [];
            var options = 0;
            var res;

            

            async function picker(req, seedReq) {
                var noSeed = 0;
                for (let m = 0; m < req.data.length; m++) {
                    
                    var title = String(req.data[m].name);
                    var resolution;
                    var season;
                    var episode;

                    resolution = parseInt( title.match(/(([0-9]{3,4}p))[^M]/) );
                    season = title.match(/([Ss]?([0-9]{1,2}))[Eex]/);
                    episode = title.match(/([Eex]([0-9]{2})(?:[^0-9]|$))/);

                    try {
                        season = season[0];
                        episode = episode[0];
                    } catch (error) {
                        season = '';
                        episode = '';
                    }
                    

                    // get size of item
                    var size = String(req.data[m].size);
                    var seeders = parseInt(req.data[m].seeders);
    
                    // set unit to var
                    var sizeUnit = size.match(/[a-zA-Z]+/);
                    
                    //Convert to float
                    var sizeNum = parseFloat(size.match(/[0-9]*\.[0-9]+/))
                    
    
                    var converted;
                    var sizeOut;
                    
    
                    // Check for unit and convert to MB
                    if (seeders >= seedReq) {
                        options ++;

                        if (sizeUnit == 'GiB' || 'GB') {
                            sizeOut = sizeNum * 1024;
                            converted = 'GB';
                        } else if (sizeUnit == 'KiB' || 'KB') {
                            sizeOut = sizeNum / 1024;
                            converted = 'KB';
                        } else if (sizeUnit == 'MiB' || 'MB') {
                            sizeOut = sizeNum;
                            converted = 'MB';
                        } else {
                            sizeOut = 'DNP';
                        }
                        if (sizeOut >= big) {
                            big = sizeOut;
                            largestID = m;
                        }
                    } else {

                        noSeed ++;
                    }

                    let listing = {
                        "title": title,
                        "resolution": resolution,
                        "size": sizeOut,
                        "seeders": seeders,
                        "season": season,
                        "episode": episode,
                        "magnet" : req.data[m].magnet,
                    }
    
                    listings.push(listing);
                    
                    
                }
                return options;

            }

            

            // Pick the torrent, if there's no listings with seedMin seeders, check again with just 5.
            await picker(req, seedMin);

            function compare( b, a ) {
                if ( a.resolution < b.resolution ){
                  return -1;
                }
                if ( a.resolution > b.resolution ){
                  return 1;
                }
                return 0;
              }
              
            listings.sort( compare );
            listings = listings.slice(0, 20);

            console.log(listings);


            async function postListings(listings) {
                var title;
                var size;
                var seeds;
                var res;
                var s;
                var e;
                var ele;
                var magnet;
                var call;
                for (let i = 0; i < listings.length; i++) {
                    title = listings[i].title;
                    size = parseFloat(listings[i].size / 1024).toFixed(2);
                    seeds = listings[i].seeders;
                    res = listings[i].resolution;
                    s = listings[i].season;
                    e = listings[i].episode;
                    magnet = listings[i].magnet;
                    call = `play('${magnet}')`;

                    ele = `
                    <a style="cursor: pointer"  title="${title}" magnet="${magnet}" class="result num${i} w-inline-block">
                        <div class="title-wrap">
                            <div class="title">${title}</div>
                            <div class="title-fade"></div>
                        </div>
                        <div class="specs">
                            <div class="spec seeders">${seeds}</div>
                            <div class="spec size">${size} GB</div>
                            <div class="spec resolution">${res}p</div>
                        </div>
                        </a>
                    `;

                    $('#results').append(ele);

                    let link = '.num' + i;


                }

            }

            await postListings(listings);


            var allButtons = $('.result');
            console.log("Found", allButtons.length, "div which class starts with num.");

            for (var i = 0; i < allButtons.length; i++) {
            allButtons[i].addEventListener('click', function() {
                console.clear();
                var activeMagnet = $(this).attr("magnet");
                play(activeMagnet);
            });
            }


            $('.animate').click();
            $('#lottie').css("display", "none");
            $('.exit').css("display", "block");

            






        }
    )


}
