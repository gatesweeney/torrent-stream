export default function play(magnet) {
    var ele;

    console.log('Opening Stream')
    console.log(magnet);

    ele = `<video id="video" 
    style="
        width: 100%;
        height: auto;
        display: block;
        margin: auto;
    ">
    </video>`
    
    $('.video').append(ele);
    const client = new WebTorrent()

    const torrentId = magnet;

    client.add(torrentId, function(torrent) {
    const file = torrent.files.find(function(file) {
        return file.name.endsWith('.mp4')
    })

    file.renderTo("#video", {
        autoplay: true,
        muted: false
    })
    })

    $('.videoin').click();

    
}