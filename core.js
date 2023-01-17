import { fetchTorrents } from "./fetchTorrent.js";

const domain = 'localhost';
const port = '8080';
const site = 'piratebay';
const limit = '50';
const seedMin = '15';
const searchAll = true;


//Remove Unnecessary webflow components



$('#email-form').on('submit', function () {
    $('.result').remove();
    console.log('Form submitted!');
    let query = $('#search').val();
    console.log(`Query: ${query}`);
    fetchTorrents(query, domain, port, site, limit, seedMin, searchAll);
});