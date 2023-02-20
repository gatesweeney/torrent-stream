import { fetchTorrents } from "./fetchTorrent.js";
import play from "./play.js";

const domain = 'localhost';
const port = '8080';
const site = 'piratebay';
const limit = '50';
const seedMin = '15';
const searchAll = true;


//Remove Unnecessary webflow components



$('#email-form').on('submit', function () {
    $('.result').remove();
    $('.unanimate').click();
    console.log('Form submitted!');
    let query = $('#search').val();
    console.log(`Query: ${query}`);
    fetchTorrents(query, domain, port, site, limit, seedMin, searchAll);
});

$('.exit').on("click", function () {
    $('.unanimate').click();
    $('.exit').css("display", "none");
    $('.search-input').val('');
    $('.search-input').focus();
});
