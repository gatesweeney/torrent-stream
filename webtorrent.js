(function (f) {
    if ("object" == typeof exports && "undefined" != typeof module) module.exports = f();
    else if ("function" == typeof define && define.amd) define([], f);
    else {
        var g;
        g = "undefined" == typeof window ? "undefined" == typeof global ? "undefined" == typeof self ? this : self : global : window, g.WebTorrent = f()
    }
})(function () {
        var _MathLN = Math.LN2,
            _Mathlog2 = Math.log,
            _Mathpow = Math.pow,
            _Mathabs = Math.abs,
            _Mathfloor = Math.floor,
            _Mathround = Math.round,
            _Mathsin = Math.sin,
            _Mathcos = Math.cos,
            _MathPI = Math.PI,
            _Mathimul = Math.imul,
            _Mathclz = Math.clz32,
            _StringfromCharCode = String.fromCharCode,
            _Mathmax = Math.max,
            _Mathceil = Math.ceil,
            _Mathmin = Math.min,
            define;
        return function () {
                function r(e, n, t) {
                    function o(i, f) {
                        if (!n[i]) {
                            if (!e[i]) {
                                var c = "function" == typeof require && require;
                                if (!f && c) return c(i, !0);
                                if (u) return u(i, !0);
                                var a = new Error("Cannot find module '" + i + "'");
                                throw a.code = "MODULE_NOT_FOUND", a
                            }
                            var p = n[i] = {
                                exports: {}
                            };
                            e[i][0].call(p.exports, function (r) {
                                var n = e[i][1][r];
                                return o(n || r)
                            }, p, p.exports, r, e, n, t)
                        }
                        return n[i].exports
                    }
                    for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
                    return o
                }
                return r
            }()({
                    1: [function (require, module) {
                        const {
                            Readable
                        } = require("streamx"), debugFactory = require("debug"), debug = debugFactory("webtorrent:file-stream");
                        module.exports = class extends Readable {
                            constructor(file, opts) {
                                super(opts ? ? {}), this._torrent = file._torrent;
                                const start = opts && opts.start || 0,
                                    end = opts && opts.end && opts.end < file.length ? opts.end : file.length - 1,
                                    pieceLength = file._torrent.pieceLength;
                                this._startPiece = 0 | (start + file.offset) / pieceLength, this._endPiece = 0 | (end + file.offset) / pieceLength, this._piece = this._startPiece, this._offset = start + file.offset - this._startPiece * pieceLength, this._missing = end - start + 1, this._reading = !1, this._notifying = !1, this._criticalLength = _Mathmin(0 | 1048576 / pieceLength, 2), this._torrent.select(this._startPiece, this._endPiece, !0, () => {
                                    this._notify()
                                })
                            }
                            _read(cb) {
                                this._reading || (this._reading = !0, this._notify(cb))
                            }
                            _notify(cb = () => {}) {
                                if (!this._reading || 0 === this._missing) return cb();
                                if (!this._torrent.bitfield.get(this._piece)) return cb(), this._torrent.critical(this._piece, this._piece + this._criticalLength);
                                if (this._notifying) return cb();
                                if (this._notifying = !0, this._torrent.destroyed) return this.destroy(new Error("Torrent removed"));
                                const p = this._piece,
                                    getOpts = {};
                                p === this._torrent.pieces.length - 1 && (getOpts.length = this._torrent.lastPieceLength), this._torrent.store.get(p, getOpts, (err, buffer) => {
                                    if (this._notifying = !1, !this.destroyed) return debug("read %s (length %s) (err %s)", p, buffer && buffer.length, err && err.message), err ? this.destroy(err) : void(this._offset && (buffer = buffer.slice(this._offset), this._offset = 0), this._missing < buffer.length && (buffer = buffer.slice(0, this._missing)), this._missing -= buffer.length, debug("pushing buffer of length %s", buffer.length), this._reading = !1, this.push(buffer), 0 === this._missing && this.push(null), cb())
                                }), this._piece += 1
                            }
                            _destroy(cb, err) {
                                this._torrent.destroyed || this._torrent.deselect(this._startPiece, this._endPiece, !0), cb(err)
                            }
                        }
                    }, {
                        debug: 91,
                        streamx: 264
                    }],
                    2: [function (require, module) {
                        const EventEmitter = require("events"),
                            {
                                PassThrough
                            } = require("streamx"),
                            path = require("path"),
                            render = require("render-media"),
                            {
                                BlobWriteStream
                            } = require("fast-blob-stream"),
                            streamToBuffer = require("stream-with-known-length-to-buffer"),
                            queueMicrotask = require("queue-microtask"),
                            rangeParser = require("range-parser"),
                            mime = require("mime"),
                            eos = require("end-of-stream"),
                            FileStream = require("./file-stream.js");
                        module.exports = class extends EventEmitter {
                            constructor(torrent, file) {
                                super(), this._torrent = torrent, this._destroyed = !1, this._fileStreams = new Set, this.name = file.name, this.path = file.path, this.length = file.length, this.offset = file.offset, this.done = !1;
                                const start = file.offset,
                                    end = start + file.length - 1;
                                this._startPiece = 0 | start / this._torrent.pieceLength, this._endPiece = 0 | end / this._torrent.pieceLength, 0 === this.length && (this.done = !0, this.emit("done")), this._serviceWorker = torrent.client.serviceWorker
                            }
                            get downloaded() {
                                if (this._destroyed || !this._torrent.bitfield) return 0;
                                const {
                                    pieces,
                                    bitfield,
                                    pieceLength,
                                    lastPieceLength
                                } = this._torrent, {
                                    _startPiece: start,
                                    _endPiece: end
                                } = this, getPieceLength = pieceIndex => pieceIndex === pieces.length - 1 ? lastPieceLength : pieceLength, getPieceDownloaded = pieceIndex => {
                                    const len = pieceIndex === pieces.length - 1 ? lastPieceLength : pieceLength;
                                    return bitfield.get(pieceIndex) ? len : len - pieces[pieceIndex].missing
                                };
                                let downloaded = 0;
                                for (let index = start; index <= end; index += 1) {
                                    const pieceDownloaded = getPieceDownloaded(index);
                                    if (downloaded += pieceDownloaded, index === start) {
                                        const irrelevantFirstPieceBytes = this.offset % pieceLength;
                                        downloaded -= _Mathmin(irrelevantFirstPieceBytes, pieceDownloaded)
                                    }
                                    if (index === end) {
                                        const irrelevantLastPieceBytes = getPieceLength(end) - (this.offset + this.length) % pieceLength;
                                        downloaded -= _Mathmin(irrelevantLastPieceBytes, pieceDownloaded)
                                    }
                                }
                                return downloaded
                            }
                            get progress() {
                                return this.length ? this.downloaded / this.length : 0
                            }
                            select(priority) {
                                0 === this.length || this._torrent.select(this._startPiece, this._endPiece, priority)
                            }
                            deselect() {
                                0 === this.length || this._torrent.deselect(this._startPiece, this._endPiece, !1)
                            }
                            createReadStream(opts) {
                                if (0 === this.length) {
                                    const empty = new PassThrough;
                                    return queueMicrotask(() => {
                                        empty.end()
                                    }), empty
                                }
                                const fileStream = new FileStream(this, opts);
                                return this._fileStreams.add(fileStream), fileStream.once("close", () => {
                                    this._fileStreams.delete(fileStream)
                                }), fileStream
                            }
                            getBuffer(cb) {
                                streamToBuffer(this.createReadStream(), this.length, cb)
                            }
                            getBlob(cb) {
                                if ("undefined" == typeof window) throw new Error("browser-only method");
                                const writeStream = new BlobWriteStream(blob => {
                                    cb(null, blob)
                                }, {
                                    mimeType: this._getMimeType()
                                });
                                this.createReadStream().pipe(writeStream)
                            }
                            getBlobURL(cb) {
                                this.getBlob((_err, blob) => {
                                    cb(null, URL.createObjectURL(blob))
                                })
                            }
                            appendTo(elem, opts, cb) {
                                if ("undefined" == typeof window) throw new Error("browser-only method");
                                render.append(this, elem, opts, cb)
                            }
                            renderTo(elem, opts, cb) {
                                if ("undefined" == typeof window) throw new Error("browser-only method");
                                render.render(this, elem, opts, cb)
                            }
                            _serve(req) {
                                const res = {
                                    status: 200,
                                    headers: {
                                        "Accept-Ranges": "bytes",
                                        "Content-Type": mime.getType(this.name),
                                        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                                        Expires: "0"
                                    },
                                    body: "HEAD" === req.method ? "" : "STREAM"
                                };
                                "document" === req.destination && (res.headers["Content-Type"] = "application/octet-stream", res.headers["Content-Disposition"] = "attachment", res.body = "DOWNLOAD");
                                let range = rangeParser(this.length, req.headers.range || "");
                                range.constructor === Array ? (res.status = 206, range = range[0], res.headers["Content-Range"] = `bytes ${range.start}-${range.end}/${this.length}`, res.headers["Content-Length"] = `${range.end-range.start+1}`) : res.headers["Content-Length"] = this.length;
                                const stream = "GET" === req.method && this.createReadStream(range);
                                let pipe = null;
                                return stream && this.emit("stream", {
                                    stream,
                                    req,
                                    file: this
                                }, piped => {
                                    pipe = piped, eos(piped, () => {
                                        piped && piped.destroy(), stream.destroy()
                                    })
                                }), [res, pipe || stream, pipe && stream]
                            }
                            getStreamURL(cb = () => {}) {
                                if ("undefined" == typeof window) throw new Error("browser-only method");
                                if (!this._serviceWorker) throw new Error("No worker registered");
                                if ("activated" !== this._serviceWorker.state) throw new Error("Worker isn't activated");
                                const workerPath = this._serviceWorker.scriptURL.slice(0, this._serviceWorker.scriptURL.lastIndexOf("/") + 1).slice(window.location.origin.length),
                                    url = `${workerPath}webtorrent/${this._torrent.infoHash}/${encodeURI(this.path)}`;
                                cb(null, url)
                            }
                            streamTo(elem, cb = () => {}) {
                                if ("undefined" == typeof window) throw new Error("browser-only method");
                                if (!this._serviceWorker) throw new Error("No worker registered");
                                if ("activated" !== this._serviceWorker.state) throw new Error("Worker isn't activated");
                                const workerPath = this._serviceWorker.scriptURL.slice(0, this._serviceWorker.scriptURL.lastIndexOf("/") + 1).slice(window.location.origin.length);
                                elem.src = `${workerPath}webtorrent/${this._torrent.infoHash}/${encodeURI(this.path)}`, cb(null, elem)
                            }
                            _getMimeType() {
                                return render.mime[path.extname(this.name).toLowerCase()]
                            }
                            _destroy() {
                                this._destroyed = !0, this._torrent = null;
                                for (const fileStream of this._fileStreams) fileStream.destroy();
                                this._fileStreams.clear()
                            }
                        }
                    }, {
                        "./file-stream.js": 1,
                        "end-of-stream": 121,
                        events: 123,
                        "fast-blob-stream": 125,
                        mime: 165,
                        path: 185,
                        "queue-microtask": 206,
                        "range-parser": 211,
                        "render-media": 229,
                        "stream-with-known-length-to-buffer": 263,
                        streamx: 264
                    }],
                    3: [function (require, module, exports) {
                        const EventEmitter = require("events"),
                            {
                                Transform
                            } = require("stream"),
                            arrayRemove = require("unordered-array-remove"),
                            debugFactory = require("debug"),
                            Wire = require("bittorrent-protocol"),
                            debug = debugFactory("webtorrent:peer");
                        let secure = !1;
                        exports.enableSecure = () => {
                            secure = !0
                        }, exports.createWebRTCPeer = (conn, swarm, throttleGroups) => {
                            const peer = new Peer(conn.id, "webrtc");
                            if (peer.conn = conn, peer.swarm = swarm, peer.throttleGroups = throttleGroups, peer.conn.connected) peer.onConnect();
                            else {
                                const cleanup = () => {
                                        peer.conn.removeListener("connect", onConnect), peer.conn.removeListener("error", onError)
                                    },
                                    onConnect = () => {
                                        cleanup(), peer.onConnect()
                                    },
                                    onError = err => {
                                        cleanup(), peer.destroy(err)
                                    };
                                peer.conn.once("connect", onConnect), peer.conn.once("error", onError), peer.startConnectTimeout()
                            }
                            return peer
                        }, exports.createTCPIncomingPeer = (conn, throttleGroups) => _createIncomingPeer(conn, "tcpIncoming", throttleGroups), exports.createUTPIncomingPeer = (conn, throttleGroups) => _createIncomingPeer(conn, "utpIncoming", throttleGroups), exports.createTCPOutgoingPeer = (addr, swarm, throttleGroups) => _createOutgoingPeer(addr, swarm, "tcpOutgoing", throttleGroups), exports.createUTPOutgoingPeer = (addr, swarm, throttleGroups) => _createOutgoingPeer(addr, swarm, "utpOutgoing", throttleGroups);
                        const _createIncomingPeer = (conn, type, throttleGroups) => {
                                const addr = `${conn.remoteAddress}:${conn.remotePort}`,
                                    peer = new Peer(addr, type);
                                return peer.conn = conn, peer.addr = addr, peer.throttleGroups = throttleGroups, peer.onConnect(), peer
                            },
                            _createOutgoingPeer = (addr, swarm, type, throttleGroups) => {
                                const peer = new Peer(addr, type);
                                return peer.addr = addr, peer.swarm = swarm, peer.throttleGroups = throttleGroups, peer
                            };
                        exports.createWebSeedPeer = (conn, id, swarm, throttleGroups) => {
                            const peer = new Peer(id, "webSeed");
                            return peer.swarm = swarm, peer.conn = conn, peer.throttleGroups = throttleGroups, peer.onConnect(), peer
                        };
                        class Peer extends EventEmitter {
                            constructor(id, type) {
                                super(), this.id = id, this.type = type, debug("new %s Peer %s", type, id), this.addr = null, this.conn = null, this.swarm = null, this.wire = null, this.connected = !1, this.destroyed = !1, this.timeout = null, this.retries = 0, this.sentPe1 = !1, this.sentPe2 = !1, this.sentPe3 = !1, this.sentPe4 = !1, this.sentHandshake = !1
                            }
                            onConnect() {
                                if (!this.destroyed) {
                                    this.connected = !0, debug("Peer %s connected", this.id), clearTimeout(this.connectTimeout);
                                    const conn = this.conn;
                                    conn.once("end", () => {
                                        this.destroy()
                                    }), conn.once("close", () => {
                                        this.destroy()
                                    }), conn.once("finish", () => {
                                        this.destroy()
                                    }), conn.once("error", err => {
                                        this.destroy(err)
                                    });
                                    const wire = this.wire = new Wire(this.type, this.retries, secure);
                                    wire.once("end", () => {
                                        this.destroy()
                                    }), wire.once("close", () => {
                                        this.destroy()
                                    }), wire.once("finish", () => {
                                        this.destroy()
                                    }), wire.once("error", err => {
                                        this.destroy(err)
                                    }), wire.once("pe1", () => {
                                        this.onPe1()
                                    }), wire.once("pe2", () => {
                                        this.onPe2()
                                    }), wire.once("pe3", () => {
                                        this.onPe3()
                                    }), wire.once("pe4", () => {
                                        this.onPe4()
                                    }), wire.once("handshake", (infoHash, peerId) => {
                                        this.onHandshake(infoHash, peerId)
                                    }), this.startHandshakeTimeout(), this.setThrottlePipes(), this.swarm && ("tcpOutgoing" === this.type ? secure && 0 === this.retries && !this.sentPe1 ? this.sendPe1() : !this.sentHandshake && this.handshake() : "tcpIncoming" !== this.type && !this.sentHandshake && this.handshake())
                                }
                            }
                            sendPe1() {
                                this.wire.sendPe1(), this.sentPe1 = !0
                            }
                            onPe1() {
                                this.sendPe2()
                            }
                            sendPe2() {
                                this.wire.sendPe2(), this.sentPe2 = !0
                            }
                            onPe2() {
                                this.sendPe3()
                            }
                            sendPe3() {
                                this.wire.sendPe3(this.swarm.infoHash), this.sentPe3 = !0
                            }
                            onPe3(infoHashHash) {
                                this.swarm && (this.swarm.infoHashHash !== infoHashHash && this.destroy(new Error("unexpected crypto handshake info hash for this swarm")), this.sendPe4())
                            }
                            sendPe4() {
                                this.wire.sendPe4(this.swarm.infoHash), this.sentPe4 = !0
                            }
                            onPe4() {
                                this.sentHandshake || this.handshake()
                            }
                            clearPipes() {
                                this.conn.unpipe(), this.wire.unpipe()
                            }
                            setThrottlePipes() {
                                const self = this;
                                this.conn.pipe(this.throttleGroups.down.throttle()).pipe(new Transform({
                                    transform(chunk, _, callback) {
                                        self.emit("download", chunk.length);
                                        self.destroyed || callback(null, chunk)
                                    }
                                })).pipe(this.wire).pipe(this.throttleGroups.up.throttle()).pipe(new Transform({
                                    transform(chunk, _, callback) {
                                        self.emit("upload", chunk.length);
                                        self.destroyed || callback(null, chunk)
                                    }
                                })).pipe(this.conn)
                            }
                            onHandshake(infoHash, peerId) {
                                if (!this.swarm) return;
                                if (this.destroyed) return;
                                if (this.swarm.destroyed) return this.destroy(new Error("swarm already destroyed"));
                                if (infoHash !== this.swarm.infoHash) return this.destroy(new Error("unexpected handshake info hash for this swarm"));
                                if (peerId === this.swarm.peerId) return this.destroy(new Error("refusing to connect to ourselves"));
                                debug("Peer %s got handshake %s", this.id, infoHash), clearTimeout(this.handshakeTimeout), this.retries = 0;
                                let addr = this.addr;
                                !addr && this.conn.remoteAddress && this.conn.remotePort && (addr = `${this.conn.remoteAddress}:${this.conn.remotePort}`), this.swarm._onWire(this.wire, addr);
                                this.swarm && !this.swarm.destroyed && (this.sentHandshake || this.handshake())
                            }
                            handshake() {
                                const opts = {
                                    dht: !this.swarm.private && !!this.swarm.client.dht,
                                    fast: !0
                                };
                                this.wire.handshake(this.swarm.infoHash, this.swarm.client.peerId, opts), this.sentHandshake = !0
                            }
                            startConnectTimeout() {
                                clearTimeout(this.connectTimeout);
                                this.connectTimeout = setTimeout(() => {
                                    this.destroy(new Error("connect timeout"))
                                }, {
                                    webrtc: 25e3,
                                    tcpOutgoing: 5e3,
                                    utpOutgoing: 5e3
                                } [this.type]), this.connectTimeout.unref && this.connectTimeout.unref()
                            }
                            startHandshakeTimeout() {
                                clearTimeout(this.handshakeTimeout), this.handshakeTimeout = setTimeout(() => {
                                    this.destroy(new Error("handshake timeout"))
                                }, 25e3), this.handshakeTimeout.unref && this.handshakeTimeout.unref()
                            }
                            destroy(err) {
                                if (this.destroyed) return;
                                this.destroyed = !0, this.connected = !1, debug("destroy %s %s (error: %s)", this.type, this.id, err && (err.message || err)), clearTimeout(this.connectTimeout), clearTimeout(this.handshakeTimeout);
                                const swarm = this.swarm,
                                    conn = this.conn,
                                    wire = this.wire;
                                this.swarm = null, this.conn = null, this.wire = null, swarm && wire && arrayRemove(swarm.wires, swarm.wires.indexOf(wire)), conn && (conn.on("error", () => {}), conn.destroy()), wire && wire.destroy(), swarm && swarm.removePeer(this.id)
                            }
                        }
                    }, {
                        "bittorrent-protocol": 32,
                        debug: 91,
                        events: 123,
                        stream: 256,
                        "unordered-array-remove": 273
                    }],
                    4: [function (require, module) {
                        module.exports = class {
                            constructor(torrent) {
                                this._torrent = torrent, this._numPieces = torrent.pieces.length, this._pieces = Array(this._numPieces), this._onWire = wire => {
                                    this.recalculate(), this._initWire(wire)
                                }, this._onWireHave = index => {
                                    this._pieces[index] += 1
                                }, this._onWireBitfield = () => {
                                    this.recalculate()
                                }, this._torrent.wires.forEach(wire => {
                                    this._initWire(wire)
                                }), this._torrent.on("wire", this._onWire), this.recalculate()
                            }
                            getRarestPiece(pieceFilterFunc) {
                                let candidates = [],
                                    min = 1 / 0;
                                for (let i = 0; i < this._numPieces; ++i) {
                                    if (pieceFilterFunc && !pieceFilterFunc(i)) continue;
                                    const availability = this._pieces[i];
                                    availability === min ? candidates.push(i) : availability < min && (candidates = [i], min = availability)
                                }
                                return candidates.length ? candidates[0 | Math.random() * candidates.length] : -1
                            }
                            destroy() {
                                this._torrent.removeListener("wire", this._onWire), this._torrent.wires.forEach(wire => {
                                    this._cleanupWireEvents(wire)
                                }), this._torrent = null, this._pieces = null, this._onWire = null, this._onWireHave = null, this._onWireBitfield = null
                            }
                            _initWire(wire) {
                                wire._onClose = () => {
                                    this._cleanupWireEvents(wire);
                                    for (let i = 0; i < this._numPieces; ++i) this._pieces[i] -= wire.peerPieces.get(i)
                                }, wire.on("have", this._onWireHave), wire.on("bitfield", this._onWireBitfield), wire.once("close", wire._onClose)
                            }
                            recalculate() {
                                this._pieces.fill(0);
                                for (const wire of this._torrent.wires)
                                    for (let i = 0; i < this._numPieces; ++i) this._pieces[i] += wire.peerPieces.get(i)
                            }
                            _cleanupWireEvents(wire) {
                                wire.removeListener("have", this._onWireHave), wire.removeListener("bitfield", this._onWireBitfield), wire._onClose && wire.removeListener("close", wire._onClose), wire._onClose = null
                            }
                        }
                    }, {}],
                    5: [function (require, module) {
                        (function (process, global) {
                            (function () {
                                function getBlockPipelineLength(wire, duration) {
                                    let length = 2 + _Mathceil(duration * wire.downloadSpeed() / Piece.BLOCK_LENGTH);
                                    if (wire.peerExtendedHandshake) {
                                        const reqq = wire.peerExtendedHandshake.reqq;
                                        "number" == typeof reqq && 0 < reqq && (length = _Mathmin(length, reqq))
                                    }
                                    return length
                                }

                                function getPiecePipelineLength(wire, duration, pieceLength) {
                                    return 1 + _Mathceil(duration * wire.downloadSpeed() / pieceLength)
                                }

                                function randomInt(high) {
                                    return 0 | Math.random() * high
                                }

                                function noop() {}
                                const EventEmitter = require("events"),
                                    fs = require("fs"),
                                    net = require("net"),
                                    os = require("os"),
                                    path = require("path"),
                                    addrToIPPort = require("addr-to-ip-port"),
                                    {
                                        default: BitField
                                    } = require("bitfield"),
                                    CacheChunkStore = require("cache-chunk-store"),
                                    ChunkStoreWriteStream = require("chunk-store-stream/write"),
                                    cpus = require("cpus"),
                                    debugFactory = require("debug"),
                                    Discovery = require("torrent-discovery"),
                                    FSChunkStore = require("fs-chunk-store"),
                                    get = require("simple-get"),
                                    ImmediateChunkStore = require("immediate-chunk-store"),
                                    ltDontHave = require("lt_donthave"),
                                    MemoryChunkStore = require("memory-chunk-store"),
                                    joinIterator = require("join-async-iterator"),
                                    parallel = require("run-parallel"),
                                    parallelLimit = require("run-parallel-limit"),
                                    parseTorrent = require("parse-torrent"),
                                    Piece = require("torrent-piece"),
                                    pump = require("pump"),
                                    queueMicrotask = require("queue-microtask"),
                                    randomIterate = require("random-iterate"),
                                    sha1 = require("simple-sha1"),
                                    throughput = require("throughput"),
                                    utMetadata = require("ut_metadata"),
                                    utPex = require("ut_pex"),
                                    {
                                        Readable
                                    } = require("streamx"),
                                    File = require("./file.js"),
                                    Peer = require("./peer.js"),
                                    RarityMap = require("./rarity-map.js"),
                                    Server = require("./server.js"),
                                    utp = require("./utp.js"),
                                    WebConn = require("./webconn.js"),
                                    debug = debugFactory("webtorrent:torrent"),
                                    CHOKE_TIMEOUT = 5e3,
                                    SPEED_THRESHOLD = 3 * Piece.BLOCK_LENGTH,
                                    PIPELINE_MAX_DURATION = 1,
                                    FILESYSTEM_CONCURRENCY = process.browser ? cpus().length : 2,
                                    RECONNECT_WAIT = [1e3, 5e3, 15e3],
                                    VERSION = require("../package.json").version,
                                    USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`;
                                let TMP;
                                try {
                                    TMP = path.join(fs.statSync("/tmp") && "/tmp", "webtorrent")
                                } catch (err) {
                                    TMP = path.join("function" == typeof os.tmpdir ? os.tmpdir() : "/", "webtorrent")
                                }
                                module.exports = class extends EventEmitter {
                                    constructor(torrentId, client, opts) {
                                        super(), this._debugId = "unknown infohash", this.client = client, this.announce = opts.announce, this.urlList = opts.urlList, this.path = opts.path || TMP, this.addUID = opts.addUID || !1, this.skipVerify = !!opts.skipVerify, this._store = opts.store || FSChunkStore, this._preloadedStore = opts.preloadedStore || null, this._storeCacheSlots = opts.storeCacheSlots === void 0 ? 20 : opts.storeCacheSlots, this._destroyStoreOnDestroy = opts.destroyStoreOnDestroy || !1, this._getAnnounceOpts = opts.getAnnounceOpts, "boolean" == typeof opts.private && (this.private = opts.private), this.strategy = opts.strategy || "sequential", this.maxWebConns = opts.maxWebConns || 4, this._rechokeNumSlots = !1 === opts.uploads || 0 === opts.uploads ? 0 : +opts.uploads || 10, this._rechokeOptimisticWire = null, this._rechokeOptimisticTime = 0, this._rechokeIntervalId = null, this.ready = !1, this.destroyed = !1, this.paused = opts.paused || !1, this.done = !1, this.metadata = null, this.store = null, this.storeOpts = opts.storeOpts, this.files = [], this.pieces = [], this._amInterested = !1, this._selections = [], this._critical = [], this.wires = [], this._queue = [], this._peers = {}, this._peersLength = 0, this.received = 0, this.uploaded = 0, this._downloadSpeed = throughput(), this._uploadSpeed = throughput(), this._servers = [], this._xsRequests = [], this._fileModtimes = opts.fileModtimes, null !== torrentId && this._onTorrentId(torrentId), this._debug("new torrent")
                                    }
                                    get timeRemaining() {
                                        return this.done ? 0 : 0 === this.downloadSpeed ? 1 / 0 : 1e3 * ((this.length - this.downloaded) / this.downloadSpeed)
                                    }
                                    get downloaded() {
                                        if (!this.bitfield) return 0;
                                        let downloaded = 0;
                                        for (let index = 0, len = this.pieces.length; index < len; ++index)
                                            if (this.bitfield.get(index)) downloaded += index === len - 1 ? this.lastPieceLength : this.pieceLength;
                                            else {
                                                const piece = this.pieces[index];
                                                downloaded += piece.length - piece.missing
                                            } return downloaded
                                    }
                                    get downloadSpeed() {
                                        return this._downloadSpeed()
                                    }
                                    get uploadSpeed() {
                                        return this._uploadSpeed()
                                    }
                                    get progress() {
                                        return this.length ? this.downloaded / this.length : 0
                                    }
                                    get ratio() {
                                        return this.uploaded / (this.received || this.length)
                                    }
                                    get numPeers() {
                                        return this.wires.length
                                    }
                                    get torrentFileBlobURL() {
                                        if ("undefined" == typeof window) throw new Error("browser-only property");
                                        return this.torrentFile ? URL.createObjectURL(new Blob([this.torrentFile], {
                                            type: "application/x-bittorrent"
                                        })) : null
                                    }
                                    get _numQueued() {
                                        return this._queue.length + (this._peersLength - this._numConns)
                                    }
                                    get _numConns() {
                                        let numConns = 0;
                                        for (const id in this._peers) this._peers[id].connected && (numConns += 1);
                                        return numConns
                                    }
                                    _onTorrentId(torrentId) {
                                        if (this.destroyed) return;
                                        let parsedTorrent;
                                        try {
                                            parsedTorrent = parseTorrent(torrentId)
                                        } catch (err) {}
                                        parsedTorrent ? (this.infoHash = parsedTorrent.infoHash, this._debugId = parsedTorrent.infoHash.toString("hex").substring(0, 7), queueMicrotask(() => {
                                            this.destroyed || this._onParsedTorrent(parsedTorrent)
                                        })) : parseTorrent.remote(torrentId, (err, parsedTorrent) => this.destroyed ? void 0 : err ? this._destroy(err) : void this._onParsedTorrent(parsedTorrent))
                                    }
                                    _onParsedTorrent(parsedTorrent) {
                                        if (!this.destroyed) {
                                            if (this._processParsedTorrent(parsedTorrent), !this.infoHash) return this._destroy(new Error("Malformed torrent data: No info hash"));
                                            (this._rechokeIntervalId = setInterval(() => {
                                                this._rechoke()
                                            }, 1e4), this._rechokeIntervalId.unref && this._rechokeIntervalId.unref(), this.emit("_infoHash", this.infoHash), !this.destroyed) && (this.emit("infoHash", this.infoHash), this.destroyed || (this.client.listening ? this._onListening() : this.client.once("listening", () => {
                                                this._onListening()
                                            })))
                                        }
                                    }
                                    _processParsedTorrent(parsedTorrent) {
                                        this._debugId = parsedTorrent.infoHash.toString("hex").substring(0, 7), "undefined" != typeof this.private && (parsedTorrent.private = this.private), this.announce && (parsedTorrent.announce = parsedTorrent.announce.concat(this.announce)), this.client.tracker && global.WEBTORRENT_ANNOUNCE && !parsedTorrent.private && (parsedTorrent.announce = parsedTorrent.announce.concat(global.WEBTORRENT_ANNOUNCE)), this.urlList && (parsedTorrent.urlList = parsedTorrent.urlList.concat(this.urlList)), parsedTorrent.announce = Array.from(new Set(parsedTorrent.announce)), parsedTorrent.urlList = Array.from(new Set(parsedTorrent.urlList)), Object.assign(this, parsedTorrent), this.magnetURI = parseTorrent.toMagnetURI(parsedTorrent), this.torrentFile = parseTorrent.toTorrentFile(parsedTorrent)
                                    }
                                    _onListening() {
                                        this.destroyed || (this.info ? this._onMetadata(this) : (this.xs && this._getMetadataFromServer(), this._startDiscovery()))
                                    }
                                    _startDiscovery() {
                                        if (this.discovery || this.destroyed) return;
                                        let trackerOpts = this.client.tracker;
                                        trackerOpts && (trackerOpts = Object.assign({}, this.client.tracker, {
                                            getAnnounceOpts: () => {
                                                if (!this.destroyed) {
                                                    const opts = {
                                                        uploaded: this.uploaded,
                                                        downloaded: this.downloaded,
                                                        left: _Mathmax(this.length - this.downloaded, 0)
                                                    };
                                                    return this.client.tracker.getAnnounceOpts && Object.assign(opts, this.client.tracker.getAnnounceOpts()), this._getAnnounceOpts && Object.assign(opts, this._getAnnounceOpts()), opts
                                                }
                                            }
                                        })), this.peerAddresses && this.peerAddresses.forEach(peer => this.addPeer(peer)), this.discovery = new Discovery({
                                            infoHash: this.infoHash,
                                            announce: this.announce,
                                            peerId: this.client.peerId,
                                            dht: !this.private && this.client.dht,
                                            tracker: trackerOpts,
                                            port: this.client.torrentPort,
                                            userAgent: USER_AGENT,
                                            lsd: this.client.lsd
                                        }), this.discovery.on("error", err => {
                                            this._destroy(err)
                                        }), this.discovery.on("peer", (peer, source) => {
                                            this._debug("peer %s discovered via %s", peer, source);
                                            "string" == typeof peer && this.done || this.addPeer(peer)
                                        }), this.discovery.on("trackerAnnounce", () => {
                                            this.emit("trackerAnnounce"), 0 === this.numPeers && this.emit("noPeers", "tracker")
                                        }), this.discovery.on("dhtAnnounce", () => {
                                            this.emit("dhtAnnounce"), 0 === this.numPeers && this.emit("noPeers", "dht")
                                        }), this.discovery.on("warning", err => {
                                            this.emit("warning", err)
                                        })
                                    }
                                    _getMetadataFromServer() {
                                        function getMetadataFromURL(url, cb) {
                                            function onResponse(err, res, torrent) {
                                                if (self.destroyed) return cb(null);
                                                if (self.metadata) return cb(null);
                                                if (err) return self.emit("warning", new Error(`http error from xs param: ${url}`)), cb(null);
                                                if (200 !== res.statusCode) return self.emit("warning", new Error(`non-200 status code ${res.statusCode} from xs param: ${url}`)), cb(null);
                                                let parsedTorrent;
                                                try {
                                                    parsedTorrent = parseTorrent(torrent)
                                                } catch (err) {}
                                                return parsedTorrent ? parsedTorrent.infoHash === self.infoHash ? void(self._onMetadata(parsedTorrent), cb(null)) : (self.emit("warning", new Error(`got torrent file with incorrect info hash from xs param: ${url}`)), cb(null)) : (self.emit("warning", new Error(`got invalid torrent file from xs param: ${url}`)), cb(null))
                                            }
                                            if (0 !== url.indexOf("http://") && 0 !== url.indexOf("https://")) return self.emit("warning", new Error(`skipping non-http xs param: ${url}`)), cb(null);
                                            let req;
                                            try {
                                                req = get.concat({
                                                    url,
                                                    method: "GET",
                                                    headers: {
                                                        "user-agent": USER_AGENT
                                                    }
                                                }, onResponse)
                                            } catch (err) {
                                                return self.emit("warning", new Error(`skipping invalid url xs param: ${url}`)), cb(null)
                                            }
                                            self._xsRequests.push(req)
                                        }
                                        const self = this,
                                            urls = Array.isArray(this.xs) ? this.xs : [this.xs],
                                            tasks = urls.map(url => cb => {
                                                getMetadataFromURL(url, cb)
                                            });
                                        parallel(tasks)
                                    }
                                    _onMetadata(metadata) {
                                        if (this.metadata || this.destroyed) return;
                                        this._debug("got metadata"), this._xsRequests.forEach(req => {
                                            req.abort()
                                        }), this._xsRequests = [];
                                        let parsedTorrent;
                                        if (metadata && metadata.infoHash) parsedTorrent = metadata;
                                        else try {
                                            parsedTorrent = parseTorrent(metadata)
                                        } catch (err) {
                                            return this._destroy(err)
                                        }
                                        this._processParsedTorrent(parsedTorrent), this.metadata = this.torrentFile, this.client.enableWebSeeds && this.urlList.forEach(url => {
                                            this.addWebSeed(url)
                                        }), this._rarityMap = new RarityMap(this), this.files = this.files.map(file => new File(this, file));
                                        let rawStore = this._preloadedStore;
                                        if (rawStore || (rawStore = new this._store(this.pieceLength, {
                                                ...this.storeOpts,
                                                torrent: this,
                                                path: this.path,
                                                files: this.files,
                                                length: this.length,
                                                name: this.name + " - " + this.infoHash.slice(0, 8),
                                                addUID: this.addUID
                                            })), 0 < this._storeCacheSlots && !(rawStore instanceof MemoryChunkStore) && (rawStore = new CacheChunkStore(rawStore, {
                                                max: this._storeCacheSlots
                                            })), this.store = new ImmediateChunkStore(rawStore), this.so ? this.files.forEach((v, i) => {
                                                this.so.includes(i) ? this.files[i].select() : this.files[i].deselect()
                                            }) : 0 !== this.pieces.length && this.select(0, this.pieces.length - 1, !1), this._hashes = this.pieces, this.pieces = this.pieces.map((hash, i) => {
                                                const pieceLength = i === this.pieces.length - 1 ? this.lastPieceLength : this.pieceLength;
                                                return new Piece(pieceLength)
                                            }), this._reservations = this.pieces.map(() => []), this.bitfield = new BitField(this.pieces.length), this.emit("metadata"), !this.destroyed)
                                            if (this.skipVerify) this._markAllVerified(), this._onStore();
                                            else {
                                                const onPiecesVerified = err => err ? this._destroy(err) : void(this._debug("done verifying"), this._onStore());
                                                this._debug("verifying existing torrent data"), this._fileModtimes && this._store === FSChunkStore ? this.getFileModtimes((err, fileModtimes) => {
                                                    if (err) return this._destroy(err);
                                                    const unchanged = this.files.map((_, index) => fileModtimes[index] === this._fileModtimes[index]).every(x => x);
                                                    unchanged ? (this._markAllVerified(), this._onStore()) : this._verifyPieces(onPiecesVerified)
                                                }) : this._verifyPieces(onPiecesVerified)
                                            }
                                    }
                                    getFileModtimes(cb) {
                                        const ret = [];
                                        parallelLimit(this.files.map((file, index) => cb => {
                                            const filePath = this.addUID ? path.join(this.name + " - " + this.infoHash.slice(0, 8)) : path.join(this.path, file.path);
                                            fs.stat(filePath, (err, stat) => err && "ENOENT" !== err.code ? cb(err) : void(ret[index] = stat && stat.mtime.getTime(), cb(null)))
                                        }), FILESYSTEM_CONCURRENCY, err => {
                                            this._debug("done getting file modtimes"), cb(err, ret)
                                        })
                                    }
                                    _verifyPieces(cb) {
                                        parallelLimit(this.pieces.map((piece, index) => cb => {
                                            if (this.destroyed) return cb(new Error("torrent is destroyed"));
                                            const getOpts = {};
                                            index === this.pieces.length - 1 && (getOpts.length = this.lastPieceLength), this.store.get(index, getOpts, (err, buf) => this.destroyed ? cb(new Error("torrent is destroyed")) : err ? queueMicrotask(() => cb(null)) : void sha1(buf, hash => this.destroyed ? cb(new Error("torrent is destroyed")) : void(hash === this._hashes[index] ? (this._debug("piece verified %s", index), this._markVerified(index)) : this._debug("piece invalid %s", index), cb(null))))
                                        }), FILESYSTEM_CONCURRENCY, cb)
                                    }
                                    rescanFiles(cb) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        cb || (cb = noop), this._verifyPieces(err => err ? (this._destroy(err), cb(err)) : void(this._checkDone(), cb(null)))
                                    }
                                    _markAllVerified() {
                                        for (let index = 0; index < this.pieces.length; index++) this._markVerified(index)
                                    }
                                    _markVerified(index) {
                                        this.pieces[index] = null, this._reservations[index] = null, this.bitfield.set(index, !0)
                                    }
                                    _hasAllPieces() {
                                        for (let index = 0; index < this.pieces.length; index++)
                                            if (!this.bitfield.get(index)) return !1;
                                        return !0
                                    }
                                    _hasNoPieces() {
                                        return !this._hasMorePieces(0)
                                    }
                                    _hasMorePieces(threshold) {
                                        let count = 0;
                                        for (let index = 0; index < this.pieces.length; index++)
                                            if (this.bitfield.get(index) && (count += 1, count > threshold)) return !0;
                                        return !1
                                    }
                                    _onStore() {
                                        this.destroyed || (this._debug("on store"), this._startDiscovery(), this.ready = !0, this.emit("ready"), this._checkDone(), this._updateSelections(), this.wires.forEach(wire => {
                                            wire.ut_metadata && wire.ut_metadata.setMetadata(this.metadata), this._onWireWithMetadata(wire)
                                        }))
                                    }
                                    destroy(opts, cb) {
                                        return "function" == typeof opts ? this.destroy(null, opts) : void this._destroy(null, opts, cb)
                                    }
                                    _destroy(err, opts, cb) {
                                        if ("function" == typeof opts) return this._destroy(err, null, opts);
                                        if (!this.destroyed) {
                                            for (const id in this.destroyed = !0, this._debug("destroy"), this.client._remove(this), clearInterval(this._rechokeIntervalId), this._xsRequests.forEach(req => {
                                                    req.abort()
                                                }), this._rarityMap && this._rarityMap.destroy(), this._peers) this.removePeer(id);
                                            this.files.forEach(file => {
                                                file instanceof File && file._destroy()
                                            });
                                            const tasks = this._servers.map(server => cb => {
                                                server.destroy(cb)
                                            });
                                            if (this.discovery && tasks.push(cb => {
                                                    this.discovery.destroy(cb)
                                                }), this.store) {
                                                let destroyStore = this._destroyStoreOnDestroy;
                                                opts && void 0 !== opts.destroyStore && (destroyStore = opts.destroyStore), tasks.push(cb => {
                                                    destroyStore ? this.store.destroy(cb) : this.store.close(cb)
                                                })
                                            }
                                            parallel(tasks, cb), err && (0 === this.listenerCount("error") ? this.client.emit("error", err) : this.emit("error", err)), this.emit("close"), this.client = null, this.files = [], this.discovery = null, this.store = null, this._rarityMap = null, this._peers = null, this._servers = null, this._xsRequests = null
                                        }
                                    }
                                    addPeer(peer) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        if (!this.infoHash) throw new Error("addPeer() must not be called before the `infoHash` event");
                                        let host;
                                        if (this.client.blocked) {
                                            if ("string" == typeof peer) {
                                                let parts;
                                                try {
                                                    parts = addrToIPPort(peer)
                                                } catch (e) {
                                                    return this._debug("ignoring peer: invalid %s", peer), this.emit("invalidPeer", peer), !1
                                                }
                                                host = parts[0]
                                            } else "string" == typeof peer.remoteAddress && (host = peer.remoteAddress);
                                            if (host && this.client.blocked.contains(host)) return this._debug("ignoring peer: blocked %s", peer), "string" != typeof peer && peer.destroy(), this.emit("blockedPeer", peer), !1
                                        }
                                        const type = this.client.utp && this._isIPv4(host) ? "utp" : "tcp",
                                            wasAdded = !!this._addPeer(peer, type);
                                        return wasAdded ? this.emit("peer", peer) : this.emit("invalidPeer", peer), wasAdded
                                    }
                                    _addPeer(peer, type) {
                                        if (this.destroyed) return "string" != typeof peer && peer.destroy(), null;
                                        if ("string" == typeof peer && !this._validAddr(peer)) return this._debug("ignoring peer: invalid %s", peer), null;
                                        const id = peer && peer.id || peer;
                                        if (this._peers[id]) return this._debug("ignoring peer: duplicate (%s)", id), "string" != typeof peer && peer.destroy(), null;
                                        if (this.paused) return this._debug("ignoring peer: torrent is paused"), "string" != typeof peer && peer.destroy(), null;
                                        this._debug("add peer %s", id);
                                        let newPeer;
                                        return newPeer = "string" == typeof peer ? "utp" === type ? Peer.createUTPOutgoingPeer(peer, this, this.client.throttleGroups) : Peer.createTCPOutgoingPeer(peer, this, this.client.throttleGroups) : Peer.createWebRTCPeer(peer, this, this.client.throttleGroups), this._registerPeer(newPeer), "string" == typeof peer && (this._queue.push(newPeer), this._drain()), newPeer
                                    }
                                    addWebSeed(urlOrConn) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        let id, conn;
                                        if ("string" == typeof urlOrConn) {
                                            if (id = urlOrConn, !/^https?:\/\/.+/.test(id)) return this.emit("warning", new Error(`ignoring invalid web seed: ${id}`)), void this.emit("invalidPeer", id);
                                            if (this._peers[id]) return this.emit("warning", new Error(`ignoring duplicate web seed: ${id}`)), void this.emit("invalidPeer", id);
                                            conn = new WebConn(id, this)
                                        } else {
                                            if (!(urlOrConn && "string" == typeof urlOrConn.connId)) return void this.emit("warning", new Error("addWebSeed must be passed a string or connection object with id property"));
                                            if (conn = urlOrConn, id = conn.connId, this._peers[id]) return this.emit("warning", new Error(`ignoring duplicate web seed: ${id}`)), void this.emit("invalidPeer", id)
                                        }
                                        this._debug("add web seed %s", id);
                                        const newPeer = Peer.createWebSeedPeer(conn, id, this, this.client.throttleGroups);
                                        this._registerPeer(newPeer), this.emit("peer", id)
                                    }
                                    _addIncomingPeer(peer) {
                                        return this.destroyed ? peer.destroy(new Error("torrent is destroyed")) : this.paused ? peer.destroy(new Error("torrent is paused")) : void(this._debug("add incoming peer %s", peer.id), this._registerPeer(peer))
                                    }
                                    _registerPeer(newPeer) {
                                        newPeer.on("download", downloaded => {
                                            this.destroyed || (this.received += downloaded, this._downloadSpeed(downloaded), this.client._downloadSpeed(downloaded), this.emit("download", downloaded), this.destroyed || this.client.emit("download", downloaded))
                                        }), newPeer.on("upload", uploaded => {
                                            this.destroyed || (this.uploaded += uploaded, this._uploadSpeed(uploaded), this.client._uploadSpeed(uploaded), this.emit("upload", uploaded), this.destroyed || this.client.emit("upload", uploaded))
                                        }), this._peers[newPeer.id] = newPeer, this._peersLength += 1
                                    }
                                    removePeer(peer) {
                                        const id = peer ? .id || peer;
                                        (peer && !peer.id && (peer = this._peers ? . [id]), !!peer) && (peer.destroy(), this.destroyed || (this._debug("removePeer %s", id), delete this._peers[id], this._peersLength -= 1, this._drain()))
                                    }
                                    select(start, end, priority, notify) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        if (0 > start || end < start || this.pieces.length <= end) throw new Error(`invalid selection ${start} : ${end}`);
                                        priority = +priority || 0, this._debug("select %s-%s (priority %s)", start, end, priority), this._selections.push({
                                            from: start,
                                            to: end,
                                            offset: 0,
                                            priority,
                                            notify: notify || noop
                                        }), this._selections.sort((a, b) => b.priority - a.priority), this._updateSelections()
                                    }
                                    deselect(start, end, priority) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        priority = +priority || 0, this._debug("deselect %s-%s (priority %s)", start, end, priority);
                                        for (let i = 0; i < this._selections.length; ++i) {
                                            const s = this._selections[i];
                                            if (s.from === start && s.to === end && s.priority === priority) {
                                                this._selections.splice(i, 1);
                                                break
                                            }
                                        }
                                        this._updateSelections()
                                    }
                                    critical(start, end) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        this._debug("critical %s-%s", start, end);
                                        for (let i = start; i <= end; ++i) this._critical[i] = !0;
                                        this._updateSelections()
                                    }
                                    _onWire(wire, addr) {
                                        if (this._debug("got wire %s (%s)", wire._debugId, addr || "Unknown"), this.wires.push(wire), addr) {
                                            const parts = addrToIPPort(addr);
                                            wire.remoteAddress = parts[0], wire.remotePort = parts[1]
                                        }
                                        this.client.dht && this.client.dht.listening && wire.on("port", port => this.destroyed || this.client.dht.destroyed ? void 0 : wire.remoteAddress ? 0 === port || 65536 < port ? this._debug("ignoring invalid PORT from peer") : void(this._debug("port: %s (from %s)", port, addr), this.client.dht.addNode({
                                            host: wire.remoteAddress,
                                            port
                                        })) : this._debug("ignoring PORT from peer with no address")), wire.on("timeout", () => {
                                            this._debug("wire timeout (%s)", addr), wire.destroy()
                                        }), "webSeed" !== wire.type && wire.setTimeout(3e4, !0), wire.setKeepAlive(!0), wire.use(utMetadata(this.metadata)), wire.ut_metadata.on("warning", err => {
                                            this._debug("ut_metadata warning: %s", err.message)
                                        }), this.metadata || (wire.ut_metadata.on("metadata", metadata => {
                                            this._debug("got metadata via ut_metadata"), this._onMetadata(metadata)
                                        }), wire.ut_metadata.fetch()), "function" != typeof utPex || this.private || (wire.use(utPex()), wire.ut_pex.on("peer", peer => {
                                            this.done || (this._debug("ut_pex: got peer: %s (from %s)", peer, addr), this.addPeer(peer))
                                        }), wire.ut_pex.on("dropped", peer => {
                                            const peerObj = this._peers[peer];
                                            peerObj && !peerObj.connected && (this._debug("ut_pex: dropped peer: %s (from %s)", peer, addr), this.removePeer(peer))
                                        }), wire.once("close", () => {
                                            wire.ut_pex.reset()
                                        })), wire.use(ltDontHave()), this.emit("wire", wire, addr), this.ready && queueMicrotask(() => {
                                            this._onWireWithMetadata(wire)
                                        })
                                    }
                                    _onWireWithMetadata(wire) {
                                        let timeoutId = null;
                                        const onChokeTimeout = () => {
                                            this.destroyed || wire.destroyed || (this._numQueued > 2 * (this._numConns - this.numPeers) && wire.amInterested ? wire.destroy() : (timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT), timeoutId.unref && timeoutId.unref()))
                                        };
                                        let i;
                                        const updateSeedStatus = () => {
                                            if (wire.peerPieces.buffer.length === this.bitfield.buffer.length) {
                                                for (i = 0; i < this.pieces.length; ++i)
                                                    if (!wire.peerPieces.get(i)) return;
                                                wire.isSeeder = !0, wire.choke()
                                            }
                                        };
                                        wire.on("bitfield", () => {
                                            updateSeedStatus(), this._update(), this._updateWireInterest(wire)
                                        }), wire.on("have", () => {
                                            updateSeedStatus(), this._update(), this._updateWireInterest(wire)
                                        }), wire.lt_donthave.on("donthave", () => {
                                            updateSeedStatus(), this._update(), this._updateWireInterest(wire)
                                        }), wire.on("have-all", () => {
                                            wire.isSeeder = !0, wire.choke(), this._update(), this._updateWireInterest(wire)
                                        }), wire.on("have-none", () => {
                                            wire.isSeeder = !1, this._update(), this._updateWireInterest(wire)
                                        }), wire.on("allowed-fast", () => {
                                            this._update()
                                        }), wire.once("interested", () => {
                                            wire.unchoke()
                                        }), wire.once("close", () => {
                                            clearTimeout(timeoutId)
                                        }), wire.on("choke", () => {
                                            clearTimeout(timeoutId), timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT), timeoutId.unref && timeoutId.unref()
                                        }), wire.on("unchoke", () => {
                                            clearTimeout(timeoutId), this._update()
                                        }), wire.on("request", (index, offset, length, cb) => length > 131072 ? wire.destroy() : void(this.pieces[index] || this.store.get(index, {
                                            offset,
                                            length
                                        }, cb))), wire.hasFast && this._hasAllPieces() ? wire.haveAll() : wire.hasFast && this._hasNoPieces() ? wire.haveNone() : wire.bitfield(this.bitfield), this._updateWireInterest(wire), wire.peerExtensions.dht && this.client.dht && this.client.dht.listening && wire.port(this.client.dht.address().port), "webSeed" !== wire.type && (timeoutId = setTimeout(onChokeTimeout, CHOKE_TIMEOUT), timeoutId.unref && timeoutId.unref()), wire.isSeeder = !1, updateSeedStatus()
                                    }
                                    _updateSelections() {
                                        !this.ready || this.destroyed || (queueMicrotask(() => {
                                            this._gcSelections()
                                        }), this._updateInterest(), this._update())
                                    }
                                    _gcSelections() {
                                        for (let i = 0; i < this._selections.length; ++i) {
                                            const s = this._selections[i],
                                                oldOffset = s.offset;
                                            for (; this.bitfield.get(s.from + s.offset) && s.from + s.offset < s.to;) s.offset += 1;
                                            oldOffset !== s.offset && s.notify(), s.to === s.from + s.offset && this.bitfield.get(s.from + s.offset) && (this._selections.splice(i, 1), i -= 1, s.notify(), this._updateInterest())
                                        }
                                        this._selections.length || this.emit("idle")
                                    }
                                    _updateInterest() {
                                        const prev = this._amInterested;
                                        this._amInterested = !!this._selections.length, this.wires.forEach(wire => this._updateWireInterest(wire));
                                        prev === this._amInterested || (this._amInterested ? this.emit("interested") : this.emit("uninterested"))
                                    }
                                    _updateWireInterest(wire) {
                                        let interested = !1;
                                        for (let index = 0; index < this.pieces.length; ++index)
                                            if (this.pieces[index] && wire.peerPieces.get(index)) {
                                                interested = !0;
                                                break
                                            } interested ? wire.interested() : wire.uninterested()
                                    }
                                    _update() {
                                        if (!this.destroyed) {
                                            const ite = randomIterate(this.wires);
                                            for (let wire; wire = ite();) this._updateWireWrapper(wire)
                                        }
                                    }
                                    _updateWireWrapper(wire) {
                                        const self = this;
                                        "undefined" != typeof window && "function" == typeof window.requestIdleCallback ? window.requestIdleCallback(() => {
                                            self._updateWire(wire)
                                        }, {
                                            timeout: 250
                                        }) : self._updateWire(wire)
                                    }
                                    _updateWire(wire) {
                                        function genPieceFilterFunc(start, end, tried, rank) {
                                            return i => i >= start && i <= end && !(i in tried) && wire.peerPieces.get(i) && (!rank || rank(i))
                                        }

                                        function speedRanker() {
                                            const speed = wire.downloadSpeed() || 1;
                                            if (speed > SPEED_THRESHOLD) return () => !0;
                                            const secs = _Mathmax(1, wire.requests.length) * Piece.BLOCK_LENGTH / speed;
                                            let tries = 10,
                                                ptr = 0;
                                            return index => {
                                                if (!tries || self.bitfield.get(index)) return !0;
                                                for (let missing = self.pieces[index].missing; ptr < self.wires.length; ptr++) {
                                                    const otherWire = self.wires[ptr],
                                                        otherSpeed = otherWire.downloadSpeed();
                                                    if (!(otherSpeed < SPEED_THRESHOLD) && !(otherSpeed <= speed) && otherWire.peerPieces.get(index) && !(0 < (missing -= otherSpeed * secs))) return tries--, !1
                                                }
                                                return !0
                                            }
                                        }

                                        function shufflePriority(i) {
                                            let last = i;
                                            for (let j = i; j < self._selections.length && self._selections[j].priority; j++) last = j;
                                            const tmp = self._selections[i];
                                            self._selections[i] = self._selections[last], self._selections[last] = tmp
                                        }

                                        function trySelectWire(hotswap) {
                                            if (wire.requests.length >= maxOutstandingRequests) return !0;
                                            const rank = speedRanker();
                                            for (let i = 0; i < self._selections.length; i++) {
                                                const next = self._selections[i];
                                                let piece;
                                                if ("rarest" === self.strategy) {
                                                    const start = next.from + next.offset,
                                                        end = next.to,
                                                        tried = {};
                                                    let tries = 0;
                                                    for (const filter = genPieceFilterFunc(start, end, tried, rank); tries < end - start + 1 && (piece = self._rarityMap.getRarestPiece(filter), !(0 > piece));) {
                                                        for (; self._request(wire, piece, self._critical[piece] || hotswap) && wire.requests.length < maxOutstandingRequests;);
                                                        if (wire.requests.length < maxOutstandingRequests) {
                                                            tried[piece] = !0, tries++;
                                                            continue
                                                        }
                                                        return next.priority && shufflePriority(i), !0
                                                    }
                                                } else
                                                    for (piece = next.from + next.offset; piece <= next.to; piece++)
                                                        if (wire.peerPieces.get(piece) && rank(piece)) {
                                                            for (; self._request(wire, piece, self._critical[piece] || hotswap) && wire.requests.length < maxOutstandingRequests;);
                                                            if (!(wire.requests.length < maxOutstandingRequests)) return next.priority && shufflePriority(i), !0
                                                        }
                                            }
                                            return !1
                                        }
                                        if (wire.destroyed) return !1;
                                        const self = this,
                                            minOutstandingRequests = getBlockPipelineLength(wire, .5);
                                        if (wire.requests.length >= minOutstandingRequests) return;
                                        const maxOutstandingRequests = getBlockPipelineLength(wire, PIPELINE_MAX_DURATION);
                                        return wire.peerChoking ? void(wire.hasFast && 0 < wire.peerAllowedFastSet.length && !this._hasMorePieces(wire.peerAllowedFastSet.length - 1) && function () {
                                            if (wire.requests.length >= maxOutstandingRequests) return !1;
                                            for (const piece of wire.peerAllowedFastSet) {
                                                if (wire.peerPieces.get(piece) && !self.bitfield.get(piece))
                                                    for (; self._request(wire, piece, !1) && wire.requests.length < maxOutstandingRequests;);
                                                if (!(wire.requests.length < maxOutstandingRequests)) return !0
                                            }
                                            return !1
                                        }()) : wire.downloaded ? void(trySelectWire(!1) || trySelectWire(!0)) : function () {
                                            if (!wire.requests.length)
                                                for (let i = self._selections.length; i--;) {
                                                    const next = self._selections[i];
                                                    let piece;
                                                    if ("rarest" === self.strategy) {
                                                        const start = next.from + next.offset,
                                                            end = next.to,
                                                            tried = {};
                                                        let tries = 0;
                                                        for (const filter = genPieceFilterFunc(start, end, tried); tries < end - start + 1 && (piece = self._rarityMap.getRarestPiece(filter), !(0 > piece));) {
                                                            if (self._request(wire, piece, !1)) return;
                                                            tried[piece] = !0, tries += 1
                                                        }
                                                    } else
                                                        for (piece = next.to; piece >= next.from + next.offset; --piece)
                                                            if (wire.peerPieces.get(piece) && self._request(wire, piece, !1)) return
                                                }
                                        }()
                                    }
                                    _rechoke() {
                                        if (this.ready) {
                                            const wireStack = this.wires.map(wire => ({
                                                wire,
                                                random: Math.random()
                                            })).sort((objA, objB) => {
                                                const wireA = objA.wire,
                                                    wireB = objB.wire;
                                                return wireA.downloadSpeed() === wireB.downloadSpeed() ? wireA.uploadSpeed() === wireB.uploadSpeed() ? wireA.amChoking === wireB.amChoking ? objA.random - objB.random : wireA.amChoking ? -1 : 1 : wireA.uploadSpeed() - wireB.uploadSpeed() : wireA.downloadSpeed() - wireB.downloadSpeed()
                                            }).map(obj => obj.wire);
                                            0 >= this._rechokeOptimisticTime ? this._rechokeOptimisticWire = null : this._rechokeOptimisticTime -= 1;
                                            for (let numInterestedUnchoked = 0; 0 < wireStack.length && numInterestedUnchoked < this._rechokeNumSlots - 1;) {
                                                const wire = wireStack.pop();
                                                wire.isSeeder || wire === this._rechokeOptimisticWire || (wire.unchoke(), wire.peerInterested && numInterestedUnchoked++)
                                            }
                                            if (null === this._rechokeOptimisticWire && 0 < this._rechokeNumSlots) {
                                                const remaining = wireStack.filter(wire => wire.peerInterested);
                                                if (0 < remaining.length) {
                                                    const newOptimisticPeer = remaining[randomInt(remaining.length)];
                                                    newOptimisticPeer.unchoke(), this._rechokeOptimisticWire = newOptimisticPeer, this._rechokeOptimisticTime = 2
                                                }
                                            }
                                            wireStack.filter(wire => wire !== this._rechokeOptimisticWire).forEach(wire => wire.choke())
                                        }
                                    }
                                    _hotswap(wire, index) {
                                        const speed = wire.downloadSpeed();
                                        if (speed < Piece.BLOCK_LENGTH) return !1;
                                        if (!this._reservations[index]) return !1;
                                        const r = this._reservations[index];
                                        if (!r) return !1;
                                        let minSpeed = 1 / 0,
                                            minWire, i;
                                        for (i = 0; i < r.length; i++) {
                                            const otherWire = r[i];
                                            if (!otherWire || otherWire === wire) continue;
                                            const otherSpeed = otherWire.downloadSpeed();
                                            otherSpeed >= SPEED_THRESHOLD || 2 * otherSpeed > speed || otherSpeed > minSpeed || (minWire = otherWire, minSpeed = otherSpeed)
                                        }
                                        if (!minWire) return !1;
                                        for (i = 0; i < r.length; i++) r[i] === minWire && (r[i] = null);
                                        for (i = 0; i < minWire.requests.length; i++) {
                                            const req = minWire.requests[i];
                                            req.piece === index && this.pieces[index].cancel(0 | req.offset / Piece.BLOCK_LENGTH)
                                        }
                                        return this.emit("hotswap", minWire, wire, index), !0
                                    }
                                    _request(wire, index, hotswap) {
                                        function onUpdateTick() {
                                            queueMicrotask(() => {
                                                self._update()
                                            })
                                        }
                                        const self = this,
                                            numRequests = wire.requests.length,
                                            isWebSeed = "webSeed" === wire.type;
                                        if (self.bitfield.get(index)) return !1;
                                        const maxOutstandingRequests = isWebSeed ? _Mathmin(getPiecePipelineLength(wire, PIPELINE_MAX_DURATION, self.pieceLength), self.maxWebConns) : getBlockPipelineLength(wire, PIPELINE_MAX_DURATION);
                                        if (numRequests >= maxOutstandingRequests) return !1;
                                        const piece = self.pieces[index];
                                        let reservation = isWebSeed ? piece.reserveRemaining() : piece.reserve();
                                        if (-1 === reservation && hotswap && self._hotswap(wire, index) && (reservation = isWebSeed ? piece.reserveRemaining() : piece.reserve()), -1 === reservation) return !1;
                                        let r = self._reservations[index];
                                        r || (r = self._reservations[index] = []);
                                        let i = r.indexOf(null); - 1 === i && (i = r.length), r[i] = wire;
                                        const chunkOffset = piece.chunkOffset(reservation),
                                            chunkLength = isWebSeed ? piece.chunkLengthRemaining(reservation) : piece.chunkLength(reservation);
                                        return wire.request(index, chunkOffset, chunkLength, function onChunk(err, chunk) {
                                            if (self.destroyed) return;
                                            if (!self.ready) return self.once("ready", () => {
                                                onChunk(err, chunk)
                                            });
                                            if (r[i] === wire && (r[i] = null), piece !== self.pieces[index]) return onUpdateTick();
                                            if (err) return self._debug("error getting piece %s (offset: %s length: %s) from %s: %s", index, chunkOffset, chunkLength, `${wire.remoteAddress}:${wire.remotePort}`, err.message), isWebSeed ? piece.cancelRemaining(reservation) : piece.cancel(reservation), void onUpdateTick();
                                            if (self._debug("got piece %s (offset: %s length: %s) from %s", index, chunkOffset, chunkLength, `${wire.remoteAddress}:${wire.remotePort}`), !piece.set(reservation, chunk, wire)) return onUpdateTick();
                                            const buf = piece.flush();
                                            sha1(buf, hash => {
                                                self.destroyed || (hash === self._hashes[index] ? (self._debug("piece verified %s", index), self.store.put(index, buf, err => err ? void self._destroy(err) : void(self.pieces[index] = null, self._markVerified(index), self.wires.forEach(wire => {
                                                    wire.have(index)
                                                }), self._checkDone() && !self.destroyed && self.discovery.complete(), onUpdateTick()))) : (self.pieces[index] = new Piece(piece.length), self.emit("warning", new Error(`Piece ${index} failed verification`)), onUpdateTick()))
                                            })
                                        }), !0
                                    }
                                    _checkDone() {
                                        if (this.destroyed) return;
                                        this.files.forEach(file => {
                                            if (!file.done) {
                                                for (let i = file._startPiece; i <= file._endPiece; ++i)
                                                    if (!this.bitfield.get(i)) return;
                                                file.done = !0, file.emit("done"), this._debug(`file done: ${file.name}`)
                                            }
                                        });
                                        let done = !0;
                                        for (const selection of this._selections) {
                                            for (let piece = selection.from; piece <= selection.to; piece++)
                                                if (!this.bitfield.get(piece)) {
                                                    done = !1;
                                                    break
                                                } if (!done) break
                                        }
                                        return !this.done && done ? (this.done = !0, this._debug(`torrent done: ${this.infoHash}`), this.emit("done")) : this.done = !1, this._gcSelections(), done
                                    }
                                    load(streams, cb) {
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        if (!this.ready) return this.once("ready", () => {
                                            this.load(streams, cb)
                                        });
                                        Array.isArray(streams) || (streams = [streams]), cb || (cb = noop);
                                        const readable = Readable.from(joinIterator(streams)),
                                            writable = new ChunkStoreWriteStream(this.store, this.pieceLength);
                                        pump(readable, writable, err => err ? cb(err) : void(this._markAllVerified(), this._checkDone(), cb(null)))
                                    }
                                    createServer(requestListener) {
                                        if ("function" != typeof Server) throw new Error("node.js-only method");
                                        if (this.destroyed) throw new Error("torrent is destroyed");
                                        const server = new Server(this, requestListener);
                                        return this._servers.push(server), server
                                    }
                                    pause() {
                                        this.destroyed || (this._debug("pause"), this.paused = !0)
                                    }
                                    resume() {
                                        this.destroyed || (this._debug("resume"), this.paused = !1, this._drain())
                                    }
                                    _debug() {
                                        const args = [].slice.call(arguments);
                                        args[0] = `[${this.client?this.client._debugId:"No Client"}] [${this._debugId}] ${args[0]}`, debug(...args)
                                    }
                                    _drain() {
                                        if (this._debug("_drain numConns %s maxConns %s", this._numConns, this.client.maxConns), "function" != typeof net.connect || this.destroyed || this.paused || this._numConns >= this.client.maxConns) return;
                                        this._debug("drain (%s queued, %s/%s peers)", this._numQueued, this.numPeers, this.client.maxConns);
                                        const peer = this._queue.shift();
                                        if (!peer) return;
                                        this._debug("%s connect attempt to %s", peer.type, peer.addr);
                                        const parts = addrToIPPort(peer.addr),
                                            opts = {
                                                host: parts[0],
                                                port: parts[1]
                                            };
                                        peer.conn = this.client.utp && "utpOutgoing" === peer.type ? utp.connect(opts.port, opts.host) : net.connect(opts);
                                        const conn = peer.conn;
                                        conn.once("connect", () => {
                                            this.destroyed || peer.onConnect()
                                        }), conn.once("error", err => {
                                            peer.destroy(err)
                                        }), peer.startConnectTimeout(), conn.on("close", () => {
                                            if (!this.destroyed) {
                                                if (peer.retries >= RECONNECT_WAIT.length) {
                                                    if (this.client.utp) {
                                                        const newPeer = this._addPeer(peer.addr, "tcp");
                                                        newPeer && (newPeer.retries = 0)
                                                    } else this._debug("conn %s closed: will not re-add (max %s attempts)", peer.addr, RECONNECT_WAIT.length);
                                                    return
                                                }
                                                const ms = RECONNECT_WAIT[peer.retries];
                                                this._debug("conn %s closed: will re-add to queue in %sms (attempt %s)", peer.addr, ms, peer.retries + 1);
                                                const reconnectTimeout = setTimeout(() => {
                                                    if (!this.destroyed) {
                                                        const host = addrToIPPort(peer.addr)[0],
                                                            type = this.client.utp && this._isIPv4(host) ? "utp" : "tcp",
                                                            newPeer = this._addPeer(peer.addr, type);
                                                        newPeer && (newPeer.retries = peer.retries + 1)
                                                    }
                                                }, ms);
                                                reconnectTimeout.unref && reconnectTimeout.unref()
                                            }
                                        })
                                    }
                                    _validAddr(addr) {
                                        let parts;
                                        try {
                                            parts = addrToIPPort(addr)
                                        } catch (e) {
                                            return !1
                                        }
                                        const host = parts[0],
                                            port = parts[1];
                                        return 0 < port && 65535 > port && ("127.0.0.1" !== host || port !== this.client.torrentPort)
                                    }
                                    _isIPv4(addr) {
                                        const IPv4Pattern = /^((?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])[.]){3}(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/;
                                        return IPv4Pattern.test(addr)
                                    }
                                }
                            }).call(this)
                        }).call(this, require("_process"), "undefined" == typeof global ? "undefined" == typeof self ? "undefined" == typeof window ? {} : window : self : global)
                    }, {
                        "../package.json": 282,
                        "./file.js": 2,
                        "./peer.js": 3,
                        "./rarity-map.js": 4,
                        "./server.js": 42,
                        "./utp.js": 42,
                        "./webconn.js": 6,
                        _process: 193,
                        "addr-to-ip-port": 7,
                        bitfield: 31,
                        "cache-chunk-store": 78,
                        "chunk-store-stream/write": 79,
                        cpus: 82,
                        debug: 91,
                        events: 123,
                        fs: 42,
                        "fs-chunk-store": 161,
                        "immediate-chunk-store": 146,
                        "join-async-iterator": 150,
                        lt_donthave: 157,
                        "memory-chunk-store": 161,
                        net: 42,
                        os: 42,
                        "parse-torrent": 184,
                        path: 185,
                        pump: 201,
                        "queue-microtask": 206,
                        "random-iterate": 208,
                        "run-parallel": 233,
                        "run-parallel-limit": 232,
                        "simple-get": 246,
                        "simple-sha1": 248,
                        streamx: 264,
                        throughput: 268,
                        "torrent-discovery": 270,
                        "torrent-piece": 271,
                        ut_metadata: 276,
                        ut_pex: 42
                    }],
                    6: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                const {
                                    default: BitField
                                } = require("bitfield"), debugFactory = require("debug"), get = require("simple-get"), ltDontHave = require("lt_donthave"), sha1 = require("simple-sha1"), Wire = require("bittorrent-protocol"), debug = debugFactory("webtorrent:webconn"), VERSION = require("../package.json").version, SOCKET_TIMEOUT = 6e4, RETRY_DELAY = 1e4;
                                class WebConn extends Wire {
                                    constructor(url, torrent) {
                                        super(), this.url = url, this.connId = url, this.webPeerId = sha1.sync(url), this._torrent = torrent, this._init()
                                    }
                                    _init() {
                                        this.setKeepAlive(!0), this.use(ltDontHave()), this.once("handshake", (infoHash, peerId) => {
                                            if (this.destroyed) return;
                                            this.handshake(infoHash, this.webPeerId);
                                            const numPieces = this._torrent.pieces.length,
                                                bitfield = new BitField(numPieces);
                                            for (let i = 0; i <= numPieces; i++) bitfield.set(i, !0);
                                            this.bitfield(bitfield)
                                        }), this.once("interested", () => {
                                            debug("interested"), this.unchoke()
                                        }), this.on("uninterested", () => {
                                            debug("uninterested")
                                        }), this.on("choke", () => {
                                            debug("choke")
                                        }), this.on("unchoke", () => {
                                            debug("unchoke")
                                        }), this.on("bitfield", () => {
                                            debug("bitfield")
                                        }), this.lt_donthave.on("donthave", () => {
                                            debug("donthave")
                                        }), this.on("request", (pieceIndex, offset, length, callback) => {
                                            debug("request pieceIndex=%d offset=%d length=%d", pieceIndex, offset, length), this.httpRequest(pieceIndex, offset, length, (err, data) => {
                                                if (err) {
                                                    this.lt_donthave.donthave(pieceIndex);
                                                    const retryTimeout = setTimeout(() => {
                                                        this.destroyed || this.have(pieceIndex)
                                                    }, RETRY_DELAY);
                                                    retryTimeout.unref && retryTimeout.unref()
                                                }
                                                callback(err, data)
                                            })
                                        })
                                    }
                                    httpRequest(pieceIndex, offset, length, cb) {
                                        const pieceOffset = pieceIndex * this._torrent.pieceLength,
                                            rangeStart = pieceOffset + offset,
                                            rangeEnd = rangeStart + length - 1,
                                            files = this._torrent.files;
                                        let requests;
                                        if (1 >= files.length) requests = [{
                                            url: this.url,
                                            start: rangeStart,
                                            end: rangeEnd
                                        }];
                                        else {
                                            const requestedFiles = files.filter(file => file.offset <= rangeEnd && file.offset + file.length > rangeStart);
                                            if (1 > requestedFiles.length) return cb(new Error("Could not find file corresponding to web seed range request"));
                                            requests = requestedFiles.map(requestedFile => {
                                                const fileEnd = requestedFile.offset + requestedFile.length - 1,
                                                    url = this.url + ("/" === this.url[this.url.length - 1] ? "" : "/") + requestedFile.path.replace(this._torrent.path, "");
                                                return {
                                                    url,
                                                    fileOffsetInRange: _Mathmax(requestedFile.offset - rangeStart, 0),
                                                    start: _Mathmax(rangeStart - requestedFile.offset, 0),
                                                    end: _Mathmin(fileEnd, rangeEnd - requestedFile.offset)
                                                }
                                            })
                                        }
                                        let numRequestsSucceeded = 0,
                                            hasError = !1,
                                            ret;
                                        1 < requests.length && (ret = Buffer.alloc(length)), requests.forEach(request => {
                                            function onResponse(res, data) {
                                                return 200 > res.statusCode || 300 <= res.statusCode ? hasError ? void 0 : (hasError = !0, cb(new Error(`Unexpected HTTP status code ${res.statusCode}`))) : void(debug("Got data of length %d", data.length), 1 === requests.length ? cb(null, data) : (data.copy(ret, request.fileOffsetInRange), ++numRequestsSucceeded === requests.length && cb(null, ret)))
                                            }
                                            const url = request.url,
                                                start = request.start,
                                                end = request.end;
                                            debug("Requesting url=%s pieceIndex=%d offset=%d length=%d start=%d end=%d", url, pieceIndex, offset, length, start, end);
                                            const opts = {
                                                url,
                                                method: "GET",
                                                headers: {
                                                    "user-agent": `WebTorrent/${VERSION} (https://webtorrent.io)`,
                                                    range: `bytes=${start}-${end}`
                                                },
                                                timeout: SOCKET_TIMEOUT
                                            };
                                            get.concat(opts, (err, res, data) => hasError ? void 0 : err ? "undefined" == typeof window || url.startsWith(`${window.location.origin}/`) ? (hasError = !0, cb(err)) : get.head(url, (errHead, res) => hasError ? void 0 : errHead ? (hasError = !0, cb(errHead)) : 200 > res.statusCode || 300 <= res.statusCode ? (hasError = !0, cb(new Error(`Unexpected HTTP status code ${res.statusCode}`))) : res.url === url ? (hasError = !0, cb(err)) : void(opts.url = res.url, get.concat(opts, (err, res, data) => hasError ? void 0 : err ? (hasError = !0, cb(err)) : void onResponse(res, data)))) : void onResponse(res, data))
                                        })
                                    }
                                    destroy() {
                                        super.destroy(), this._torrent = null
                                    }
                                }
                                module.exports = WebConn
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        "../package.json": 282,
                        bitfield: 31,
                        "bittorrent-protocol": 32,
                        buffer: 76,
                        debug: 91,
                        lt_donthave: 157,
                        "simple-get": 246,
                        "simple-sha1": 248
                    }],
                    7: [function (require, module, exports) {
                        const ADDR_RE = /^\[?([^\]]+)]?:(\d+)$/;
                        let cache = new Map;
                        module.exports = function addrToIPPort(addr) {
                            if (1e5 === cache.size && cache.clear(), !cache.has(addr)) {
                                const m = ADDR_RE.exec(addr);
                                if (!m) throw new Error(`invalid addr: ${addr}`);
                                cache.set(addr, [m[1], +m[2]])
                            }
                            return cache.get(addr)
                        }
                    }, {}],
                    8: [function (require, module, exports) {
                        "use strict";
                        const asn1 = exports;
                        asn1.bignum = require("bn.js"), asn1.define = require("./asn1/api").define, asn1.base = require("./asn1/base"), asn1.constants = require("./asn1/constants"), asn1.decoders = require("./asn1/decoders"), asn1.encoders = require("./asn1/encoders")
                    }, {
                        "./asn1/api": 9,
                        "./asn1/base": 11,
                        "./asn1/constants": 15,
                        "./asn1/decoders": 17,
                        "./asn1/encoders": 20,
                        "bn.js": 22
                    }],
                    9: [function (require, module, exports) {
                        "use strict";

                        function Entity(name, body) {
                            this.name = name, this.body = body, this.decoders = {}, this.encoders = {}
                        }
                        const encoders = require("./encoders"),
                            decoders = require("./decoders"),
                            inherits = require("inherits"),
                            api = exports;
                        api.define = function define(name, body) {
                            return new Entity(name, body)
                        }, Entity.prototype._createNamed = function createNamed(Base) {
                            function Generated(entity) {
                                this._initNamed(entity, name)
                            }
                            const name = this.name;
                            return inherits(Generated, Base), Generated.prototype._initNamed = function _initNamed(entity, name) {
                                Base.call(this, entity, name)
                            }, new Generated(this)
                        }, Entity.prototype._getDecoder = function _getDecoder(enc) {
                            return enc = enc || "der", this.decoders.hasOwnProperty(enc) || (this.decoders[enc] = this._createNamed(decoders[enc])), this.decoders[enc]
                        }, Entity.prototype.decode = function decode(data, enc, options) {
                            return this._getDecoder(enc).decode(data, options)
                        }, Entity.prototype._getEncoder = function _getEncoder(enc) {
                            return enc = enc || "der", this.encoders.hasOwnProperty(enc) || (this.encoders[enc] = this._createNamed(encoders[enc])), this.encoders[enc]
                        }, Entity.prototype.encode = function encode(data, enc, reporter) {
                            return this._getEncoder(enc).encode(data, reporter)
                        }
                    }, {
                        "./decoders": 17,
                        "./encoders": 20,
                        inherits: 147
                    }],
                    10: [function (require, module, exports) {
                        "use strict";

                        function DecoderBuffer(base, options) {
                            return Reporter.call(this, options), Buffer.isBuffer(base) ? void(this.base = base, this.offset = 0, this.length = base.length) : void this.error("Input not Buffer")
                        }

                        function EncoderBuffer(value, reporter) {
                            if (Array.isArray(value)) this.length = 0, this.value = value.map(function (item) {
                                return EncoderBuffer.isEncoderBuffer(item) || (item = new EncoderBuffer(item, reporter)), this.length += item.length, item
                            }, this);
                            else if ("number" == typeof value) {
                                if (!(0 <= value && 255 >= value)) return reporter.error("non-byte EncoderBuffer value");
                                this.value = value, this.length = 1
                            } else if ("string" == typeof value) this.value = value, this.length = Buffer.byteLength(value);
                            else if (Buffer.isBuffer(value)) this.value = value, this.length = value.length;
                            else return reporter.error("Unsupported type: " + typeof value)
                        }
                        const inherits = require("inherits"),
                            Reporter = require("../base/reporter").Reporter,
                            Buffer = require("safer-buffer").Buffer;
                        inherits(DecoderBuffer, Reporter), exports.DecoderBuffer = DecoderBuffer, DecoderBuffer.isDecoderBuffer = function isDecoderBuffer(data) {
                            if (data instanceof DecoderBuffer) return !0;
                            const isCompatible = "object" == typeof data && Buffer.isBuffer(data.base) && "DecoderBuffer" === data.constructor.name && "number" == typeof data.offset && "number" == typeof data.length && "function" == typeof data.save && "function" == typeof data.restore && "function" == typeof data.isEmpty && "function" == typeof data.readUInt8 && "function" == typeof data.skip && "function" == typeof data.raw;
                            return isCompatible
                        }, DecoderBuffer.prototype.save = function save() {
                            return {
                                offset: this.offset,
                                reporter: Reporter.prototype.save.call(this)
                            }
                        }, DecoderBuffer.prototype.restore = function restore(save) {
                            const res = new DecoderBuffer(this.base);
                            return res.offset = save.offset, res.length = this.offset, this.offset = save.offset, Reporter.prototype.restore.call(this, save.reporter), res
                        }, DecoderBuffer.prototype.isEmpty = function isEmpty() {
                            return this.offset === this.length
                        }, DecoderBuffer.prototype.readUInt8 = function readUInt8(fail) {
                            return this.offset + 1 <= this.length ? this.base.readUInt8(this.offset++, !0) : this.error(fail || "DecoderBuffer overrun")
                        }, DecoderBuffer.prototype.skip = function skip(bytes, fail) {
                            if (!(this.offset + bytes <= this.length)) return this.error(fail || "DecoderBuffer overrun");
                            const res = new DecoderBuffer(this.base);
                            return res._reporterState = this._reporterState, res.offset = this.offset, res.length = this.offset + bytes, this.offset += bytes, res
                        }, DecoderBuffer.prototype.raw = function raw(save) {
                            return this.base.slice(save ? save.offset : this.offset, this.length)
                        }, exports.EncoderBuffer = EncoderBuffer, EncoderBuffer.isEncoderBuffer = function isEncoderBuffer(data) {
                            if (data instanceof EncoderBuffer) return !0;
                            const isCompatible = "object" == typeof data && "EncoderBuffer" === data.constructor.name && "number" == typeof data.length && "function" == typeof data.join;
                            return isCompatible
                        }, EncoderBuffer.prototype.join = function join(out, offset) {
                            return (out || (out = Buffer.alloc(this.length)), offset || (offset = 0), 0 === this.length) ? out : (Array.isArray(this.value) ? this.value.forEach(function (item) {
                                item.join(out, offset), offset += item.length
                            }) : ("number" == typeof this.value ? out[offset] = this.value : "string" == typeof this.value ? out.write(this.value, offset) : Buffer.isBuffer(this.value) && this.value.copy(out, offset), offset += this.length), out)
                        }
                    }, {
                        "../base/reporter": 13,
                        inherits: 147,
                        "safer-buffer": 236
                    }],
                    11: [function (require, module, exports) {
                        "use strict";
                        const base = exports;
                        base.Reporter = require("./reporter").Reporter, base.DecoderBuffer = require("./buffer").DecoderBuffer, base.EncoderBuffer = require("./buffer").EncoderBuffer, base.Node = require("./node")
                    }, {
                        "./buffer": 10,
                        "./node": 12,
                        "./reporter": 13
                    }],
                    12: [function (require, module, exports) {
                        "use strict";

                        function Node(enc, parent, name) {
                            const state = {};
                            this._baseState = state, state.name = name, state.enc = enc, state.parent = parent || null, state.children = null, state.tag = null, state.args = null, state.reverseArgs = null, state.choice = null, state.optional = !1, state.any = !1, state.obj = !1, state.use = null, state.useDecoder = null, state.key = null, state["default"] = null, state.explicit = null, state.implicit = null, state.contains = null, state.parent || (state.children = [], this._wrap())
                        }
                        const Reporter = require("../base/reporter").Reporter,
                            EncoderBuffer = require("../base/buffer").EncoderBuffer,
                            DecoderBuffer = require("../base/buffer").DecoderBuffer,
                            assert = require("minimalistic-assert"),
                            tags = ["seq", "seqof", "set", "setof", "objid", "bool", "gentime", "utctime", "null_", "enum", "int", "objDesc", "bitstr", "bmpstr", "charstr", "genstr", "graphstr", "ia5str", "iso646str", "numstr", "octstr", "printstr", "t61str", "unistr", "utf8str", "videostr"],
                            methods = ["key", "obj", "use", "optional", "explicit", "implicit", "def", "choice", "any", "contains"].concat(tags),
                            overrided = ["_peekTag", "_decodeTag", "_use", "_decodeStr", "_decodeObjid", "_decodeTime", "_decodeNull", "_decodeInt", "_decodeBool", "_decodeList", "_encodeComposite", "_encodeStr", "_encodeObjid", "_encodeTime", "_encodeNull", "_encodeInt", "_encodeBool"];
                        module.exports = Node;
                        const stateProps = ["enc", "parent", "children", "tag", "args", "reverseArgs", "choice", "optional", "any", "obj", "use", "alteredUse", "key", "default", "explicit", "implicit", "contains"];
                        Node.prototype.clone = function clone() {
                            const state = this._baseState,
                                cstate = {};
                            stateProps.forEach(function (prop) {
                                cstate[prop] = state[prop]
                            });
                            const res = new this.constructor(cstate.parent);
                            return res._baseState = cstate, res
                        }, Node.prototype._wrap = function wrap() {
                            const state = this._baseState;
                            methods.forEach(function (method) {
                                this[method] = function _wrappedMethod() {
                                    const clone = new this.constructor(this);
                                    return state.children.push(clone), clone[method].apply(clone, arguments)
                                }
                            }, this)
                        }, Node.prototype._init = function init(body) {
                            const state = this._baseState;
                            assert(null === state.parent), body.call(this), state.children = state.children.filter(function (child) {
                                return child._baseState.parent === this
                            }, this), assert.equal(state.children.length, 1, "Root node can have only one child")
                        }, Node.prototype._useArgs = function useArgs(args) {
                            const state = this._baseState,
                                children = args.filter(function (arg) {
                                    return arg instanceof this.constructor
                                }, this);
                            args = args.filter(function (arg) {
                                return !(arg instanceof this.constructor)
                            }, this), 0 !== children.length && (assert(null === state.children), state.children = children, children.forEach(function (child) {
                                child._baseState.parent = this
                            }, this)), 0 !== args.length && (assert(null === state.args), state.args = args, state.reverseArgs = args.map(function (arg) {
                                if ("object" != typeof arg || arg.constructor !== Object) return arg;
                                const res = {};
                                return Object.keys(arg).forEach(function (key) {
                                    key == (0 | key) && (key |= 0);
                                    const value = arg[key];
                                    res[value] = key
                                }), res
                            }))
                        }, overrided.forEach(function (method) {
                            Node.prototype[method] = function _overrided() {
                                const state = this._baseState;
                                throw new Error(method + " not implemented for encoding: " + state.enc)
                            }
                        }), tags.forEach(function (tag) {
                            Node.prototype[tag] = function _tagMethod() {
                                const state = this._baseState,
                                    args = Array.prototype.slice.call(arguments);
                                return assert(null === state.tag), state.tag = tag, this._useArgs(args), this
                            }
                        }), Node.prototype.use = function use(item) {
                            assert(item);
                            const state = this._baseState;
                            return assert(null === state.use), state.use = item, this
                        }, Node.prototype.optional = function optional() {
                            const state = this._baseState;
                            return state.optional = !0, this
                        }, Node.prototype.def = function def(val) {
                            const state = this._baseState;
                            return assert(null === state["default"]), state["default"] = val, state.optional = !0, this
                        }, Node.prototype.explicit = function explicit(num) {
                            const state = this._baseState;
                            return assert(null === state.explicit && null === state.implicit), state.explicit = num, this
                        }, Node.prototype.implicit = function implicit(num) {
                            const state = this._baseState;
                            return assert(null === state.explicit && null === state.implicit), state.implicit = num, this
                        }, Node.prototype.obj = function obj() {
                            const state = this._baseState,
                                args = Array.prototype.slice.call(arguments);
                            return state.obj = !0, 0 !== args.length && this._useArgs(args), this
                        }, Node.prototype.key = function key(newKey) {
                            const state = this._baseState;
                            return assert(null === state.key), state.key = newKey, this
                        }, Node.prototype.any = function any() {
                            const state = this._baseState;
                            return state.any = !0, this
                        }, Node.prototype.choice = function choice(obj) {
                            const state = this._baseState;
                            return assert(null === state.choice), state.choice = obj, this._useArgs(Object.keys(obj).map(function (key) {
                                return obj[key]
                            })), this
                        }, Node.prototype.contains = function contains(item) {
                            const state = this._baseState;
                            return assert(null === state.use), state.contains = item, this
                        }, Node.prototype._decode = function decode(input, options) {
                            const state = this._baseState;
                            if (null === state.parent) return input.wrapResult(state.children[0]._decode(input, options));
                            let result = state["default"],
                                present = !0,
                                prevKey = null;
                            if (null !== state.key && (prevKey = input.enterKey(state.key)), state.optional) {
                                let tag = null;
                                if (null === state.explicit ? null === state.implicit ? null !== state.tag && (tag = state.tag) : tag = state.implicit : tag = state.explicit, null === tag && !state.any) {
                                    const save = input.save();
                                    try {
                                        null === state.choice ? this._decodeGeneric(state.tag, input, options) : this._decodeChoice(input, options), present = !0
                                    } catch (e) {
                                        present = !1
                                    }
                                    input.restore(save)
                                } else if (present = this._peekTag(input, tag, state.any), input.isError(present)) return present
                            }
                            let prevObj;
                            if (state.obj && present && (prevObj = input.enterObject()), present) {
                                if (null !== state.explicit) {
                                    const explicit = this._decodeTag(input, state.explicit);
                                    if (input.isError(explicit)) return explicit;
                                    input = explicit
                                }
                                const start = input.offset;
                                if (null === state.use && null === state.choice) {
                                    let save;
                                    state.any && (save = input.save());
                                    const body = this._decodeTag(input, null === state.implicit ? state.tag : state.implicit, state.any);
                                    if (input.isError(body)) return body;
                                    state.any ? result = input.raw(save) : input = body
                                }
                                if (options && options.track && null !== state.tag && options.track(input.path(), start, input.length, "tagged"), options && options.track && null !== state.tag && options.track(input.path(), input.offset, input.length, "content"), state.any || (null === state.choice ? result = this._decodeGeneric(state.tag, input, options) : result = this._decodeChoice(input, options)), input.isError(result)) return result;
                                if (state.any || null !== state.choice || null === state.children || state.children.forEach(function decodeChildren(child) {
                                        child._decode(input, options)
                                    }), state.contains && ("octstr" === state.tag || "bitstr" === state.tag)) {
                                    const data = new DecoderBuffer(result);
                                    result = this._getUse(state.contains, input._reporterState.obj)._decode(data, options)
                                }
                            }
                            return state.obj && present && (result = input.leaveObject(prevObj)), null !== state.key && (null !== result || !0 === present) ? input.leaveKey(prevKey, state.key, result) : null !== prevKey && input.exitKey(prevKey), result
                        }, Node.prototype._decodeGeneric = function decodeGeneric(tag, input, options) {
                            const state = this._baseState;
                            if ("seq" === tag || "set" === tag) return null;
                            return "seqof" === tag || "setof" === tag ? this._decodeList(input, tag, state.args[0], options) : /str$/.test(tag) ? this._decodeStr(input, tag, options) : "objid" === tag && state.args ? this._decodeObjid(input, state.args[0], state.args[1], options) : "objid" === tag ? this._decodeObjid(input, null, null, options) : "gentime" === tag || "utctime" === tag ? this._decodeTime(input, tag, options) : "null_" === tag ? this._decodeNull(input, options) : "bool" === tag ? this._decodeBool(input, options) : "objDesc" === tag ? this._decodeStr(input, tag, options) : "int" === tag || "enum" === tag ? this._decodeInt(input, state.args && state.args[0], options) : null === state.use ? input.error("unknown tag: " + tag) : this._getUse(state.use, input._reporterState.obj)._decode(input, options)
                        }, Node.prototype._getUse = function _getUse(entity, obj) {
                            const state = this._baseState;
                            return state.useDecoder = this._use(entity, obj), assert(null === state.useDecoder._baseState.parent), state.useDecoder = state.useDecoder._baseState.children[0], state.implicit !== state.useDecoder._baseState.implicit && (state.useDecoder = state.useDecoder.clone(), state.useDecoder._baseState.implicit = state.implicit), state.useDecoder
                        }, Node.prototype._decodeChoice = function decodeChoice(input, options) {
                            const state = this._baseState;
                            let result = null,
                                match = !1;
                            return Object.keys(state.choice).some(function (key) {
                                const save = input.save(),
                                    node = state.choice[key];
                                try {
                                    const value = node._decode(input, options);
                                    if (input.isError(value)) return !1;
                                    result = {
                                        type: key,
                                        value: value
                                    }, match = !0
                                } catch (e) {
                                    return input.restore(save), !1
                                }
                                return !0
                            }, this), match ? result : input.error("Choice not matched")
                        }, Node.prototype._createEncoderBuffer = function createEncoderBuffer(data) {
                            return new EncoderBuffer(data, this.reporter)
                        }, Node.prototype._encode = function encode(data, reporter, parent) {
                            const state = this._baseState;
                            if (null === state["default"] || state["default"] !== data) {
                                const result = this._encodeValue(data, reporter, parent);
                                return void 0 === result || this._skipDefault(result, reporter, parent) ? void 0 : result
                            }
                        }, Node.prototype._encodeValue = function encode(data, reporter, parent) {
                            const state = this._baseState;
                            if (null === state.parent) return state.children[0]._encode(data, reporter || new Reporter);
                            let result = null;
                            if (this.reporter = reporter, state.optional && void 0 === data)
                                if (null !== state["default"]) data = state["default"];
                                else return;
                            let content = null,
                                primitive = !1;
                            if (state.any) result = this._createEncoderBuffer(data);
                            else if (state.choice) result = this._encodeChoice(data, reporter);
                            else if (state.contains) content = this._getUse(state.contains, parent)._encode(data, reporter), primitive = !0;
                            else if (state.children) content = state.children.map(function (child) {
                                if ("null_" === child._baseState.tag) return child._encode(null, reporter, data);
                                if (null === child._baseState.key) return reporter.error("Child should have a key");
                                const prevKey = reporter.enterKey(child._baseState.key);
                                if ("object" != typeof data) return reporter.error("Child expected, but input is not object");
                                const res = child._encode(data[child._baseState.key], reporter, data);
                                return reporter.leaveKey(prevKey), res
                            }, this).filter(function (child) {
                                return child
                            }), content = this._createEncoderBuffer(content);
                            else if ("seqof" === state.tag || "setof" === state.tag) {
                                if (!(state.args && 1 === state.args.length)) return reporter.error("Too many args for : " + state.tag);
                                if (!Array.isArray(data)) return reporter.error("seqof/setof, but data is not Array");
                                const child = this.clone();
                                child._baseState.implicit = null, content = this._createEncoderBuffer(data.map(function (item) {
                                    const state = this._baseState;
                                    return this._getUse(state.args[0], data)._encode(item, reporter)
                                }, child))
                            } else null === state.use ? (content = this._encodePrimitive(state.tag, data), primitive = !0) : result = this._getUse(state.use, parent)._encode(data, reporter);
                            if (!state.any && null === state.choice) {
                                const tag = null === state.implicit ? state.tag : state.implicit,
                                    cls = null === state.implicit ? "universal" : "context";
                                null === tag ? null === state.use && reporter.error("Tag could be omitted only for .use()") : null === state.use && (result = this._encodeComposite(tag, primitive, cls, content))
                            }
                            return null !== state.explicit && (result = this._encodeComposite(state.explicit, !1, "context", result)), result
                        }, Node.prototype._encodeChoice = function encodeChoice(data, reporter) {
                            const state = this._baseState,
                                node = state.choice[data.type];
                            return node || assert(!1, data.type + " not found in " + JSON.stringify(Object.keys(state.choice))), node._encode(data.value, reporter)
                        }, Node.prototype._encodePrimitive = function encodePrimitive(tag, data) {
                            const state = this._baseState;
                            if (/str$/.test(tag)) return this._encodeStr(data, tag);
                            if ("objid" === tag && state.args) return this._encodeObjid(data, state.reverseArgs[0], state.args[1]);
                            if ("objid" === tag) return this._encodeObjid(data, null, null);
                            if ("gentime" === tag || "utctime" === tag) return this._encodeTime(data, tag);
                            if ("null_" === tag) return this._encodeNull();
                            if ("int" === tag || "enum" === tag) return this._encodeInt(data, state.args && state.reverseArgs[0]);
                            if ("bool" === tag) return this._encodeBool(data);
                            if ("objDesc" === tag) return this._encodeStr(data, tag);
                            throw new Error("Unsupported tag: " + tag)
                        }, Node.prototype._isNumstr = function isNumstr(str) {
                            return /^[0-9 ]*$/.test(str)
                        }, Node.prototype._isPrintstr = function isPrintstr(str) {
                            return /^[A-Za-z0-9 '()+,-./:=?]*$/.test(str)
                        }
                    }, {
                        "../base/buffer": 10,
                        "../base/reporter": 13,
                        "minimalistic-assert": 168
                    }],
                    13: [function (require, module, exports) {
                        "use strict";

                        function Reporter(options) {
                            this._reporterState = {
                                obj: null,
                                path: [],
                                options: options || {},
                                errors: []
                            }
                        }

                        function ReporterError(path, msg) {
                            this.path = path, this.rethrow(msg)
                        }
                        const inherits = require("inherits");
                        exports.Reporter = Reporter, Reporter.prototype.isError = function isError(obj) {
                            return obj instanceof ReporterError
                        }, Reporter.prototype.save = function save() {
                            const state = this._reporterState;
                            return {
                                obj: state.obj,
                                pathLen: state.path.length
                            }
                        }, Reporter.prototype.restore = function restore(data) {
                            const state = this._reporterState;
                            state.obj = data.obj, state.path = state.path.slice(0, data.pathLen)
                        }, Reporter.prototype.enterKey = function enterKey(key) {
                            return this._reporterState.path.push(key)
                        }, Reporter.prototype.exitKey = function exitKey(index) {
                            const state = this._reporterState;
                            state.path = state.path.slice(0, index - 1)
                        }, Reporter.prototype.leaveKey = function leaveKey(index, key, value) {
                            const state = this._reporterState;
                            this.exitKey(index), null !== state.obj && (state.obj[key] = value)
                        }, Reporter.prototype.path = function path() {
                            return this._reporterState.path.join("/")
                        }, Reporter.prototype.enterObject = function enterObject() {
                            const state = this._reporterState,
                                prev = state.obj;
                            return state.obj = {}, prev
                        }, Reporter.prototype.leaveObject = function leaveObject(prev) {
                            const state = this._reporterState,
                                now = state.obj;
                            return state.obj = prev, now
                        }, Reporter.prototype.error = function error(msg) {
                            let err;
                            const state = this._reporterState,
                                inherited = msg instanceof ReporterError;
                            if (err = inherited ? msg : new ReporterError(state.path.map(function (elem) {
                                    return "[" + JSON.stringify(elem) + "]"
                                }).join(""), msg.message || msg, msg.stack), !state.options.partial) throw err;
                            return inherited || state.errors.push(err), err
                        }, Reporter.prototype.wrapResult = function wrapResult(result) {
                            const state = this._reporterState;
                            return state.options.partial ? {
                                result: this.isError(result) ? null : result,
                                errors: state.errors
                            } : result
                        }, inherits(ReporterError, Error), ReporterError.prototype.rethrow = function rethrow(msg) {
                            if (this.message = msg + " at: " + (this.path || "(shallow)"), Error.captureStackTrace && Error.captureStackTrace(this, ReporterError), !this.stack) try {
                                throw new Error(this.message)
                            } catch (e) {
                                this.stack = e.stack
                            }
                            return this
                        }
                    }, {
                        inherits: 147
                    }],
                    14: [function (require, module, exports) {
                        "use strict";

                        function reverse(map) {
                            const res = {};
                            return Object.keys(map).forEach(function (key) {
                                (0 | key) == key && (key |= 0);
                                const value = map[key];
                                res[value] = key
                            }), res
                        }
                        exports.tagClass = {
                            0: "universal",
                            1: "application",
                            2: "context",
                            3: "private"
                        }, exports.tagClassByName = reverse(exports.tagClass), exports.tag = {
                            0: "end",
                            1: "bool",
                            2: "int",
                            3: "bitstr",
                            4: "octstr",
                            5: "null_",
                            6: "objid",
                            7: "objDesc",
                            8: "external",
                            9: "real",
                            10: "enum",
                            11: "embed",
                            12: "utf8str",
                            13: "relativeOid",
                            16: "seq",
                            17: "set",
                            18: "numstr",
                            19: "printstr",
                            20: "t61str",
                            21: "videostr",
                            22: "ia5str",
                            23: "utctime",
                            24: "gentime",
                            25: "graphstr",
                            26: "iso646str",
                            27: "genstr",
                            28: "unistr",
                            29: "charstr",
                            30: "bmpstr"
                        }, exports.tagByName = reverse(exports.tag)
                    }, {}],
                    15: [function (require, module, exports) {
                        "use strict";
                        const constants = exports;
                        constants._reverse = function reverse(map) {
                            const res = {};
                            return Object.keys(map).forEach(function (key) {
                                (0 | key) == key && (key |= 0);
                                const value = map[key];
                                res[value] = key
                            }), res
                        }, constants.der = require("./der")
                    }, {
                        "./der": 14
                    }],
                    16: [function (require, module, exports) {
                        "use strict";

                        function DERDecoder(entity) {
                            this.enc = "der", this.name = entity.name, this.entity = entity, this.tree = new DERNode, this.tree._init(entity.body)
                        }

                        function DERNode(parent) {
                            Node.call(this, "der", parent)
                        }

                        function derDecodeTag(buf, fail) {
                            let tag = buf.readUInt8(fail);
                            if (buf.isError(tag)) return tag;
                            const cls = der.tagClass[tag >> 6],
                                primitive = 0 == (32 & tag);
                            if (31 == (31 & tag)) {
                                let oct = tag;
                                for (tag = 0; 128 == (128 & oct);) {
                                    if (oct = buf.readUInt8(fail), buf.isError(oct)) return oct;
                                    tag <<= 7, tag |= 127 & oct
                                }
                            } else tag &= 31;
                            const tagStr = der.tag[tag];
                            return {
                                cls: cls,
                                primitive: primitive,
                                tag: tag,
                                tagStr: tagStr
                            }
                        }

                        function derDecodeLen(buf, primitive, fail) {
                            let len = buf.readUInt8(fail);
                            if (buf.isError(len)) return len;
                            if (!primitive && 128 === len) return null;
                            if (0 == (128 & len)) return len;
                            const num = 127 & len;
                            if (4 < num) return buf.error("length octect is too long");
                            len = 0;
                            for (let i = 0; i < num; i++) {
                                len <<= 8;
                                const j = buf.readUInt8(fail);
                                if (buf.isError(j)) return j;
                                len |= j
                            }
                            return len
                        }
                        const inherits = require("inherits"),
                            bignum = require("bn.js"),
                            DecoderBuffer = require("../base/buffer").DecoderBuffer,
                            Node = require("../base/node"),
                            der = require("../constants/der");
                        module.exports = DERDecoder, DERDecoder.prototype.decode = function decode(data, options) {
                            return DecoderBuffer.isDecoderBuffer(data) || (data = new DecoderBuffer(data, options)), this.tree._decode(data, options)
                        }, inherits(DERNode, Node), DERNode.prototype._peekTag = function peekTag(buffer, tag, any) {
                            if (buffer.isEmpty()) return !1;
                            const state = buffer.save(),
                                decodedTag = derDecodeTag(buffer, "Failed to peek tag: \"" + tag + "\"");
                            return buffer.isError(decodedTag) ? decodedTag : (buffer.restore(state), decodedTag.tag === tag || decodedTag.tagStr === tag || decodedTag.tagStr + "of" === tag || any)
                        }, DERNode.prototype._decodeTag = function decodeTag(buffer, tag, any) {
                            const decodedTag = derDecodeTag(buffer, "Failed to decode tag of \"" + tag + "\"");
                            if (buffer.isError(decodedTag)) return decodedTag;
                            let len = derDecodeLen(buffer, decodedTag.primitive, "Failed to get length of \"" + tag + "\"");
                            if (buffer.isError(len)) return len;
                            if (!any && decodedTag.tag !== tag && decodedTag.tagStr !== tag && decodedTag.tagStr + "of" !== tag) return buffer.error("Failed to match tag: \"" + tag + "\"");
                            if (decodedTag.primitive || null !== len) return buffer.skip(len, "Failed to match body of: \"" + tag + "\"");
                            const state = buffer.save(),
                                res = this._skipUntilEnd(buffer, "Failed to skip indefinite length body: \"" + this.tag + "\"");
                            return buffer.isError(res) ? res : (len = buffer.offset - state.offset, buffer.restore(state), buffer.skip(len, "Failed to match body of: \"" + tag + "\""))
                        }, DERNode.prototype._skipUntilEnd = function skipUntilEnd(buffer, fail) {
                            for (;;) {
                                const tag = derDecodeTag(buffer, fail);
                                if (buffer.isError(tag)) return tag;
                                const len = derDecodeLen(buffer, tag.primitive, fail);
                                if (buffer.isError(len)) return len;
                                let res;
                                if (res = tag.primitive || null !== len ? buffer.skip(len) : this._skipUntilEnd(buffer, fail), buffer.isError(res)) return res;
                                if ("end" === tag.tagStr) break
                            }
                        }, DERNode.prototype._decodeList = function decodeList(buffer, tag, decoder, options) {
                            const result = [];
                            for (; !buffer.isEmpty();) {
                                const possibleEnd = this._peekTag(buffer, "end");
                                if (buffer.isError(possibleEnd)) return possibleEnd;
                                const res = decoder.decode(buffer, "der", options);
                                if (buffer.isError(res) && possibleEnd) break;
                                result.push(res)
                            }
                            return result
                        }, DERNode.prototype._decodeStr = function decodeStr(buffer, tag) {
                            if ("bitstr" === tag) {
                                const unused = buffer.readUInt8();
                                return buffer.isError(unused) ? unused : {
                                    unused: unused,
                                    data: buffer.raw()
                                }
                            }
                            if ("bmpstr" === tag) {
                                const raw = buffer.raw();
                                if (1 == raw.length % 2) return buffer.error("Decoding of string type: bmpstr length mismatch");
                                let str = "";
                                for (let i = 0; i < raw.length / 2; i++) str += _StringfromCharCode(raw.readUInt16BE(2 * i));
                                return str
                            }
                            if ("numstr" === tag) {
                                const numstr = buffer.raw().toString("ascii");
                                return this._isNumstr(numstr) ? numstr : buffer.error("Decoding of string type: numstr unsupported characters")
                            }
                            if ("octstr" === tag) return buffer.raw();
                            if ("objDesc" === tag) return buffer.raw();
                            if ("printstr" === tag) {
                                const printstr = buffer.raw().toString("ascii");
                                return this._isPrintstr(printstr) ? printstr : buffer.error("Decoding of string type: printstr unsupported characters")
                            }
                            return /str$/.test(tag) ? buffer.raw().toString() : buffer.error("Decoding of string type: " + tag + " unsupported")
                        }, DERNode.prototype._decodeObjid = function decodeObjid(buffer, values, relative) {
                            let result;
                            const identifiers = [];
                            let ident = 0,
                                subident = 0;
                            for (; !buffer.isEmpty();) subident = buffer.readUInt8(), ident <<= 7, ident |= 127 & subident, 0 == (128 & subident) && (identifiers.push(ident), ident = 0);
                            128 & subident && identifiers.push(ident);
                            const first = 0 | identifiers[0] / 40,
                                second = identifiers[0] % 40;
                            if (result = relative ? identifiers : [first, second].concat(identifiers.slice(1)), values) {
                                let tmp = values[result.join(" ")];
                                void 0 === tmp && (tmp = values[result.join(".")]), void 0 !== tmp && (result = tmp)
                            }
                            return result
                        }, DERNode.prototype._decodeTime = function decodeTime(buffer, tag) {
                            const str = buffer.raw().toString();
                            let year, mon, day, hour, min, sec;
                            if ("gentime" === tag) year = 0 | str.slice(0, 4), mon = 0 | str.slice(4, 6), day = 0 | str.slice(6, 8), hour = 0 | str.slice(8, 10), min = 0 | str.slice(10, 12), sec = 0 | str.slice(12, 14);
                            else if ("utctime" === tag) year = 0 | str.slice(0, 2), mon = 0 | str.slice(2, 4), day = 0 | str.slice(4, 6), hour = 0 | str.slice(6, 8), min = 0 | str.slice(8, 10), sec = 0 | str.slice(10, 12), year = 70 > year ? 2e3 + year : 1900 + year;
                            else return buffer.error("Decoding " + tag + " time is not supported yet");
                            return Date.UTC(year, mon - 1, day, hour, min, sec, 0)
                        }, DERNode.prototype._decodeNull = function decodeNull() {
                            return null
                        }, DERNode.prototype._decodeBool = function decodeBool(buffer) {
                            const res = buffer.readUInt8();
                            return buffer.isError(res) ? res : 0 !== res
                        }, DERNode.prototype._decodeInt = function decodeInt(buffer, values) {
                            const raw = buffer.raw();
                            let res = new bignum(raw);
                            return values && (res = values[res.toString(10)] || res), res
                        }, DERNode.prototype._use = function use(entity, obj) {
                            return "function" == typeof entity && (entity = entity(obj)), entity._getDecoder("der").tree
                        }
                    }, {
                        "../base/buffer": 10,
                        "../base/node": 12,
                        "../constants/der": 14,
                        "bn.js": 22,
                        inherits: 147
                    }],
                    17: [function (require, module, exports) {
                        "use strict";
                        const decoders = exports;
                        decoders.der = require("./der"), decoders.pem = require("./pem")
                    }, {
                        "./der": 16,
                        "./pem": 18
                    }],
                    18: [function (require, module, exports) {
                        "use strict";

                        function PEMDecoder(entity) {
                            DERDecoder.call(this, entity), this.enc = "pem"
                        }
                        const inherits = require("inherits"),
                            Buffer = require("safer-buffer").Buffer,
                            DERDecoder = require("./der");
                        inherits(PEMDecoder, DERDecoder), module.exports = PEMDecoder, PEMDecoder.prototype.decode = function decode(data, options) {
                            const lines = data.toString().split(/[\r\n]+/g),
                                label = options.label.toUpperCase(),
                                re = /^-----(BEGIN|END) ([^-]+)-----$/;
                            let start = -1,
                                end = -1;
                            for (let i = 0; i < lines.length; i++) {
                                const match = lines[i].match(re);
                                if (null !== match && match[2] === label)
                                    if (-1 === start) {
                                        if ("BEGIN" !== match[1]) break;
                                        start = i
                                    } else {
                                        if ("END" !== match[1]) break;
                                        end = i;
                                        break
                                    }
                            }
                            if (-1 === start || -1 === end) throw new Error("PEM section not found for: " + label);
                            const base64 = lines.slice(start + 1, end).join("");
                            base64.replace(/[^a-z0-9+/=]+/gi, "");
                            const input = Buffer.from(base64, "base64");
                            return DERDecoder.prototype.decode.call(this, input, options)
                        }
                    }, {
                        "./der": 16,
                        inherits: 147,
                        "safer-buffer": 236
                    }],
                    19: [function (require, module, exports) {
                        "use strict";

                        function DEREncoder(entity) {
                            this.enc = "der", this.name = entity.name, this.entity = entity, this.tree = new DERNode, this.tree._init(entity.body)
                        }

                        function DERNode(parent) {
                            Node.call(this, "der", parent)
                        }

                        function two(num) {
                            return 10 > num ? "0" + num : num
                        }

                        function encodeTag(tag, primitive, cls, reporter) {
                            let res;
                            if ("seqof" === tag ? tag = "seq" : "setof" == tag && (tag = "set"), der.tagByName.hasOwnProperty(tag)) res = der.tagByName[tag];
                            else if ("number" == typeof tag && (0 | tag) === tag) res = tag;
                            else return reporter.error("Unknown tag: " + tag);
                            return 31 <= res ? reporter.error("Multi-octet tag encoding unsupported") : (primitive || (res |= 32), res |= der.tagClassByName[cls || "universal"] << 6, res)
                        }
                        const inherits = require("inherits"),
                            Buffer = require("safer-buffer").Buffer,
                            Node = require("../base/node"),
                            der = require("../constants/der");
                        module.exports = DEREncoder, DEREncoder.prototype.encode = function encode(data, reporter) {
                            return this.tree._encode(data, reporter).join()
                        }, inherits(DERNode, Node), DERNode.prototype._encodeComposite = function encodeComposite(tag, primitive, cls, content) {
                            const encodedTag = encodeTag(tag, primitive, cls, this.reporter);
                            if (128 > content.length) {
                                const header = Buffer.alloc(2);
                                return header[0] = encodedTag, header[1] = content.length, this._createEncoderBuffer([header, content])
                            }
                            let lenOctets = 1;
                            for (let i = content.length; 256 <= i; i >>= 8) lenOctets++;
                            const header = Buffer.alloc(2 + lenOctets);
                            header[0] = encodedTag, header[1] = 128 | lenOctets;
                            for (let i = 1 + lenOctets, j = content.length; 0 < j; i--, j >>= 8) header[i] = 255 & j;
                            return this._createEncoderBuffer([header, content])
                        }, DERNode.prototype._encodeStr = function encodeStr(str, tag) {
                            if ("bitstr" === tag) return this._createEncoderBuffer([0 | str.unused, str.data]);
                            if ("bmpstr" === tag) {
                                const buf = Buffer.alloc(2 * str.length);
                                for (let i = 0; i < str.length; i++) buf.writeUInt16BE(str.charCodeAt(i), 2 * i);
                                return this._createEncoderBuffer(buf)
                            }
                            return "numstr" === tag ? this._isNumstr(str) ? this._createEncoderBuffer(str) : this.reporter.error("Encoding of string type: numstr supports only digits and space") : "printstr" === tag ? this._isPrintstr(str) ? this._createEncoderBuffer(str) : this.reporter.error("Encoding of string type: printstr supports only latin upper and lower case letters, digits, space, apostrophe, left and rigth parenthesis, plus sign, comma, hyphen, dot, slash, colon, equal sign, question mark") : /str$/.test(tag) ? this._createEncoderBuffer(str) : "objDesc" === tag ? this._createEncoderBuffer(str) : this.reporter.error("Encoding of string type: " + tag + " unsupported")
                        }, DERNode.prototype._encodeObjid = function encodeObjid(id, values, relative) {
                            if ("string" == typeof id) {
                                if (!values) return this.reporter.error("string objid given, but no values map found");
                                if (!values.hasOwnProperty(id)) return this.reporter.error("objid not found in values map");
                                id = values[id].split(/[\s.]+/g);
                                for (let i = 0; i < id.length; i++) id[i] |= 0
                            } else if (Array.isArray(id)) {
                                id = id.slice();
                                for (let i = 0; i < id.length; i++) id[i] |= 0
                            }
                            if (!Array.isArray(id)) return this.reporter.error("objid() should be either array or string, got: " + JSON.stringify(id));
                            if (!relative) {
                                if (40 <= id[1]) return this.reporter.error("Second objid identifier OOB");
                                id.splice(0, 2, 40 * id[0] + id[1])
                            }
                            let size = 0;
                            for (let i = 0, ident; i < id.length; i++)
                                for (ident = id[i], size++; 128 <= ident; ident >>= 7) size++;
                            const objid = Buffer.alloc(size);
                            let offset = objid.length - 1;
                            for (let i = id.length - 1, ident; 0 <= i; i--)
                                for (ident = id[i], objid[offset--] = 127 & ident; 0 < (ident >>= 7);) objid[offset--] = 128 | 127 & ident;
                            return this._createEncoderBuffer(objid)
                        }, DERNode.prototype._encodeTime = function encodeTime(time, tag) {
                            let str;
                            const date = new Date(time);
                            return "gentime" === tag ? str = [two(date.getUTCFullYear()), two(date.getUTCMonth() + 1), two(date.getUTCDate()), two(date.getUTCHours()), two(date.getUTCMinutes()), two(date.getUTCSeconds()), "Z"].join("") : "utctime" === tag ? str = [two(date.getUTCFullYear() % 100), two(date.getUTCMonth() + 1), two(date.getUTCDate()), two(date.getUTCHours()), two(date.getUTCMinutes()), two(date.getUTCSeconds()), "Z"].join("") : this.reporter.error("Encoding " + tag + " time is not supported yet"), this._encodeStr(str, "octstr")
                        }, DERNode.prototype._encodeNull = function encodeNull() {
                            return this._createEncoderBuffer("")
                        }, DERNode.prototype._encodeInt = function encodeInt(num, values) {
                            if ("string" == typeof num) {
                                if (!values) return this.reporter.error("String int or enum given, but no values map");
                                if (!values.hasOwnProperty(num)) return this.reporter.error("Values map doesn't contain: " + JSON.stringify(num));
                                num = values[num]
                            }
                            if ("number" != typeof num && !Buffer.isBuffer(num)) {
                                const numArray = num.toArray();
                                !num.sign && 128 & numArray[0] && numArray.unshift(0), num = Buffer.from(numArray)
                            }
                            if (Buffer.isBuffer(num)) {
                                let size = num.length;
                                0 === num.length && size++;
                                const out = Buffer.alloc(size);
                                return num.copy(out), 0 === num.length && (out[0] = 0), this._createEncoderBuffer(out)
                            }
                            if (128 > num) return this._createEncoderBuffer(num);
                            if (256 > num) return this._createEncoderBuffer([0, num]);
                            let size = 1;
                            for (let i = num; 256 <= i; i >>= 8) size++;
                            const out = Array(size);
                            for (let i = out.length - 1; 0 <= i; i--) out[i] = 255 & num, num >>= 8;
                            return 128 & out[0] && out.unshift(0), this._createEncoderBuffer(Buffer.from(out))
                        }, DERNode.prototype._encodeBool = function encodeBool(value) {
                            return this._createEncoderBuffer(value ? 255 : 0)
                        }, DERNode.prototype._use = function use(entity, obj) {
                            return "function" == typeof entity && (entity = entity(obj)), entity._getEncoder("der").tree
                        }, DERNode.prototype._skipDefault = function skipDefault(dataBuffer, reporter, parent) {
                            const state = this._baseState;
                            let i;
                            if (null === state["default"]) return !1;
                            const data = dataBuffer.join();
                            if (void 0 === state.defaultBuffer && (state.defaultBuffer = this._encodeValue(state["default"], reporter, parent).join()), data.length !== state.defaultBuffer.length) return !1;
                            for (i = 0; i < data.length; i++)
                                if (data[i] !== state.defaultBuffer[i]) return !1;
                            return !0
                        }
                    }, {
                        "../base/node": 12,
                        "../constants/der": 14,
                        inherits: 147,
                        "safer-buffer": 236
                    }],
                    20: [function (require, module, exports) {
                        "use strict";
                        const encoders = exports;
                        encoders.der = require("./der"), encoders.pem = require("./pem")
                    }, {
                        "./der": 19,
                        "./pem": 21
                    }],
                    21: [function (require, module, exports) {
                        "use strict";

                        function PEMEncoder(entity) {
                            DEREncoder.call(this, entity), this.enc = "pem"
                        }
                        const inherits = require("inherits"),
                            DEREncoder = require("./der");
                        inherits(PEMEncoder, DEREncoder), module.exports = PEMEncoder, PEMEncoder.prototype.encode = function encode(data, options) {
                            const buf = DEREncoder.prototype.encode.call(this, data),
                                p = buf.toString("base64"),
                                out = ["-----BEGIN " + options.label + "-----"];
                            for (let i = 0; i < p.length; i += 64) out.push(p.slice(i, i + 64));
                            return out.push("-----END " + options.label + "-----"), out.join("\n")
                        }
                    }, {
                        "./der": 19,
                        inherits: 147
                    }],
                    22: [function (require, module, exports) {
                        (function (module, exports) {
                            "use strict";

                            function assert(val, msg) {
                                if (!val) throw new Error(msg || "Assertion failed")
                            }

                            function inherits(ctor, superCtor) {
                                ctor.super_ = superCtor;
                                var TempCtor = function () {};
                                TempCtor.prototype = superCtor.prototype, ctor.prototype = new TempCtor, ctor.prototype.constructor = ctor
                            }

                            function BN(number, base, endian) {
                                return BN.isBN(number) ? number : void(this.negative = 0, this.words = null, this.length = 0, this.red = null, null !== number && (("le" === base || "be" === base) && (endian = base, base = 10), this._init(number || 0, base || 10, endian || "be")))
                            }

                            function parseHex4Bits(string, index) {
                                var c = string.charCodeAt(index);
                                return 65 <= c && 70 >= c ? c - 55 : 97 <= c && 102 >= c ? c - 87 : 15 & c - 48
                            }

                            function parseHexByte(string, lowerBound, index) {
                                var r = parseHex4Bits(string, index);
                                return index - 1 >= lowerBound && (r |= parseHex4Bits(string, index - 1) << 4), r
                            }

                            function parseBase(str, start, end, mul) {
                                for (var r = 0, len = _Mathmin(str.length, end), i = start, c; i < len; i++) c = str.charCodeAt(i) - 48, r *= mul, r += 49 <= c ? c - 49 + 10 : 17 <= c ? c - 17 + 10 : c;
                                return r
                            }

                            function toBitArray(num) {
                                for (var w = Array(num.bitLength()), bit = 0; bit < w.length; bit++) {
                                    var off = 0 | bit / 26,
                                        wbit = bit % 26;
                                    w[bit] = (num.words[off] & 1 << wbit) >>> wbit
                                }
                                return w
                            }

                            function smallMulTo(self, num, out) {
                                out.negative = num.negative ^ self.negative;
                                var len = 0 | self.length + num.length;
                                out.length = len, len = 0 | len - 1;
                                var a = 0 | self.words[0],
                                    b = 0 | num.words[0],
                                    r = a * b,
                                    lo = 67108863 & r,
                                    carry = 0 | r / 67108864;
                                out.words[0] = lo;
                                for (var k = 1; k < len; k++) {
                                    for (var ncarry = carry >>> 26, rword = 67108863 & carry, maxJ = _Mathmin(k, num.length - 1), j = _Mathmax(0, k - self.length + 1), i; j <= maxJ; j++) i = 0 | k - j, a = 0 | self.words[i], b = 0 | num.words[j], r = a * b + rword, ncarry += 0 | r / 67108864, rword = 67108863 & r;
                                    out.words[k] = 0 | rword, carry = 0 | ncarry
                                }
                                return 0 === carry ? out.length-- : out.words[k] = 0 | carry, out.strip()
                            }

                            function bigMulTo(self, num, out) {
                                out.negative = num.negative ^ self.negative, out.length = self.length + num.length;
                                for (var carry = 0, hncarry = 0, k = 0, ncarry; k < out.length - 1; k++) {
                                    ncarry = hncarry, hncarry = 0;
                                    for (var rword = 67108863 & carry, maxJ = _Mathmin(k, num.length - 1), j = _Mathmax(0, k - self.length + 1); j <= maxJ; j++) {
                                        var i = k - j,
                                            a = 0 | self.words[i],
                                            b = 0 | num.words[j],
                                            r = a * b,
                                            lo = 67108863 & r;
                                        ncarry = 0 | ncarry + (0 | r / 67108864), lo = 0 | lo + rword, rword = 67108863 & lo, ncarry = 0 | ncarry + (lo >>> 26), hncarry += ncarry >>> 26, ncarry &= 67108863
                                    }
                                    out.words[k] = rword, carry = ncarry, ncarry = hncarry
                                }
                                return 0 === carry ? out.length-- : out.words[k] = carry, out.strip()
                            }

                            function jumboMulTo(self, num, out) {
                                var fftm = new FFTM;
                                return fftm.mulp(self, num, out)
                            }

                            function FFTM(x, y) {
                                this.x = x, this.y = y
                            }

                            function MPrime(name, p) {
                                this.name = name, this.p = new BN(p, 16), this.n = this.p.bitLength(), this.k = new BN(1).iushln(this.n).isub(this.p), this.tmp = this._tmp()
                            }

                            function K256() {
                                MPrime.call(this, "k256", "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f")
                            }

                            function P224() {
                                MPrime.call(this, "p224", "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001")
                            }

                            function P192() {
                                MPrime.call(this, "p192", "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff")
                            }

                            function P25519() {
                                MPrime.call(this, "25519", "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed")
                            }

                            function Red(m) {
                                if ("string" == typeof m) {
                                    var prime = BN._prime(m);
                                    this.m = prime.p, this.prime = prime
                                } else assert(m.gtn(1), "modulus must be greater than 1"), this.m = m, this.prime = null
                            }

                            function Mont(m) {
                                Red.call(this, m), this.shift = this.m.bitLength(), 0 != this.shift % 26 && (this.shift += 26 - this.shift % 26), this.r = new BN(1).iushln(this.shift), this.r2 = this.imod(this.r.sqr()), this.rinv = this.r._invmp(this.m), this.minv = this.rinv.mul(this.r).isubn(1).div(this.m), this.minv = this.minv.umod(this.r), this.minv = this.r.sub(this.minv)
                            }
                            "object" == typeof module ? module.exports = BN : exports.BN = BN, BN.BN = BN, BN.wordSize = 26;
                            var Buffer;
                            try {
                                Buffer = "undefined" != typeof window && "undefined" != typeof window.Buffer ? window.Buffer : require("buffer").Buffer
                            } catch (e) {}
                            BN.isBN = function isBN(num) {
                                return !!(num instanceof BN) || null !== num && "object" == typeof num && num.constructor.wordSize === BN.wordSize && Array.isArray(num.words)
                            }, BN.max = function max(left, right) {
                                return 0 < left.cmp(right) ? left : right
                            }, BN.min = function min(left, right) {
                                return 0 > left.cmp(right) ? left : right
                            }, BN.prototype._init = function init(number, base, endian) {
                                if ("number" == typeof number) return this._initNumber(number, base, endian);
                                if ("object" == typeof number) return this._initArray(number, base, endian);
                                "hex" === base && (base = 16), assert(base === (0 | base) && 2 <= base && 36 >= base), number = number.toString().replace(/\s+/g, "");
                                var start = 0;
                                "-" === number[0] && (start++, this.negative = 1), start < number.length && (16 === base ? this._parseHex(number, start, endian) : (this._parseBase(number, base, start), "le" === endian && this._initArray(this.toArray(), base, endian)))
                            }, BN.prototype._initNumber = function _initNumber(number, base, endian) {
                                0 > number && (this.negative = 1, number = -number), 67108864 > number ? (this.words = [67108863 & number], this.length = 1) : 4503599627370496 > number ? (this.words = [67108863 & number, 67108863 & number / 67108864], this.length = 2) : (assert(9007199254740992 > number), this.words = [67108863 & number, 67108863 & number / 67108864, 1], this.length = 3);
                                "le" !== endian || this._initArray(this.toArray(), base, endian)
                            }, BN.prototype._initArray = function _initArray(number, base, endian) {
                                if (assert("number" == typeof number.length), 0 >= number.length) return this.words = [0], this.length = 1, this;
                                this.length = _Mathceil(number.length / 3), this.words = Array(this.length);
                                for (var i = 0; i < this.length; i++) this.words[i] = 0;
                                var off = 0,
                                    j, w;
                                if ("be" === endian)
                                    for (i = number.length - 1, j = 0; 0 <= i; i -= 3) w = number[i] | number[i - 1] << 8 | number[i - 2] << 16, this.words[j] |= 67108863 & w << off, this.words[j + 1] = 67108863 & w >>> 26 - off, off += 24, 26 <= off && (off -= 26, j++);
                                else if ("le" === endian)
                                    for (i = 0, j = 0; i < number.length; i += 3) w = number[i] | number[i + 1] << 8 | number[i + 2] << 16, this.words[j] |= 67108863 & w << off, this.words[j + 1] = 67108863 & w >>> 26 - off, off += 24, 26 <= off && (off -= 26, j++);
                                return this.strip()
                            }, BN.prototype._parseHex = function _parseHex(number, start, endian) {
                                this.length = _Mathceil((number.length - start) / 6), this.words = Array(this.length);
                                for (var i = 0; i < this.length; i++) this.words[i] = 0;
                                var off = 0,
                                    j = 0,
                                    w;
                                if ("be" === endian)
                                    for (i = number.length - 1; i >= start; i -= 2) w = parseHexByte(number, start, i) << off, this.words[j] |= 67108863 & w, 18 <= off ? (off -= 18, j += 1, this.words[j] |= w >>> 26) : off += 8;
                                else {
                                    var parseLength = number.length - start;
                                    for (i = 0 == parseLength % 2 ? start + 1 : start; i < number.length; i += 2) w = parseHexByte(number, start, i) << off, this.words[j] |= 67108863 & w, 18 <= off ? (off -= 18, j += 1, this.words[j] |= w >>> 26) : off += 8
                                }
                                this.strip()
                            }, BN.prototype._parseBase = function _parseBase(number, base, start) {
                                this.words = [0], this.length = 1;
                                for (var limbLen = 0, limbPow = 1; 67108863 >= limbPow; limbPow *= base) limbLen++;
                                limbLen--, limbPow = 0 | limbPow / base;
                                for (var total = number.length - start, mod = total % limbLen, end = _Mathmin(total, total - mod) + start, word = 0, i = start; i < end; i += limbLen) word = parseBase(number, i, i + limbLen, base), this.imuln(limbPow), 67108864 > this.words[0] + word ? this.words[0] += word : this._iaddn(word);
                                if (0 !== mod) {
                                    var pow = 1;
                                    for (word = parseBase(number, i, number.length, base), i = 0; i < mod; i++) pow *= base;
                                    this.imuln(pow), 67108864 > this.words[0] + word ? this.words[0] += word : this._iaddn(word)
                                }
                                this.strip()
                            }, BN.prototype.copy = function copy(dest) {
                                dest.words = Array(this.length);
                                for (var i = 0; i < this.length; i++) dest.words[i] = this.words[i];
                                dest.length = this.length, dest.negative = this.negative, dest.red = this.red
                            }, BN.prototype.clone = function clone() {
                                var r = new BN(null);
                                return this.copy(r), r
                            }, BN.prototype._expand = function _expand(size) {
                                for (; this.length < size;) this.words[this.length++] = 0;
                                return this
                            }, BN.prototype.strip = function strip() {
                                for (; 1 < this.length && 0 === this.words[this.length - 1];) this.length--;
                                return this._normSign()
                            }, BN.prototype._normSign = function _normSign() {
                                return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this
                            }, BN.prototype.inspect = function inspect() {
                                return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">"
                            };
                            var zeros = ["", "0", "00", "000", "0000", "00000", "000000", "0000000", "00000000", "000000000", "0000000000", "00000000000", "000000000000", "0000000000000", "00000000000000", "000000000000000", "0000000000000000", "00000000000000000", "000000000000000000", "0000000000000000000", "00000000000000000000", "000000000000000000000", "0000000000000000000000", "00000000000000000000000", "000000000000000000000000", "0000000000000000000000000"],
                                groupSizes = [0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
                                groupBases = [0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721, 1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224, 47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176];
                            BN.prototype.toString = function toString(base, padding) {
                                base = base || 10, padding = 0 | padding || 1;
                                var out;
                                if (16 === base || "hex" === base) {
                                    out = "";
                                    for (var off = 0, carry = 0, i = 0; i < this.length; i++) {
                                        var w = this.words[i],
                                            word = (16777215 & (w << off | carry)).toString(16);
                                        carry = 16777215 & w >>> 24 - off, out = 0 !== carry || i !== this.length - 1 ? zeros[6 - word.length] + word + out : word + out, off += 2, 26 <= off && (off -= 26, i--)
                                    }
                                    for (0 !== carry && (out = carry.toString(16) + out); 0 != out.length % padding;) out = "0" + out;
                                    return 0 !== this.negative && (out = "-" + out), out
                                }
                                if (base === (0 | base) && 2 <= base && 36 >= base) {
                                    var groupSize = groupSizes[base],
                                        groupBase = groupBases[base];
                                    out = "";
                                    var c = this.clone();
                                    for (c.negative = 0; !c.isZero();) {
                                        var r = c.modn(groupBase).toString(base);
                                        c = c.idivn(groupBase), out = c.isZero() ? r + out : zeros[groupSize - r.length] + r + out
                                    }
                                    for (this.isZero() && (out = "0" + out); 0 != out.length % padding;) out = "0" + out;
                                    return 0 !== this.negative && (out = "-" + out), out
                                }
                                assert(!1, "Base should be between 2 and 36")
                            }, BN.prototype.toNumber = function toNumber() {
                                var ret = this.words[0];
                                return 2 === this.length ? ret += 67108864 * this.words[1] : 3 === this.length && 1 === this.words[2] ? ret += 4503599627370496 + 67108864 * this.words[1] : 2 < this.length && assert(!1, "Number can only safely store up to 53 bits"), 0 === this.negative ? ret : -ret
                            }, BN.prototype.toJSON = function toJSON() {
                                return this.toString(16)
                            }, BN.prototype.toBuffer = function toBuffer(endian, length) {
                                return assert("undefined" != typeof Buffer), this.toArrayLike(Buffer, endian, length)
                            }, BN.prototype.toArray = function toArray(endian, length) {
                                return this.toArrayLike(Array, endian, length)
                            }, BN.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
                                var byteLength = this.byteLength(),
                                    reqLength = length || _Mathmax(1, byteLength);
                                assert(byteLength <= reqLength, "byte array longer than desired length"), assert(0 < reqLength, "Requested array length <= 0"), this.strip();
                                var littleEndian = "le" === endian,
                                    res = new ArrayType(reqLength),
                                    q = this.clone(),
                                    b, i;
                                if (!littleEndian) {
                                    for (i = 0; i < reqLength - byteLength; i++) res[i] = 0;
                                    for (i = 0; !q.isZero(); i++) b = q.andln(255), q.iushrn(8), res[reqLength - i - 1] = b
                                } else {
                                    for (i = 0; !q.isZero(); i++) b = q.andln(255), q.iushrn(8), res[i] = b;
                                    for (; i < reqLength; i++) res[i] = 0
                                }
                                return res
                            }, BN.prototype._countBits = _Mathclz ? function _countBits(w) {
                                return 32 - _Mathclz(w)
                            } : function _countBits(w) {
                                var t = w,
                                    r = 0;
                                return 4096 <= t && (r += 13, t >>>= 13), 64 <= t && (r += 7, t >>>= 7), 8 <= t && (r += 4, t >>>= 4), 2 <= t && (r += 2, t >>>= 2), r + t
                            }, BN.prototype._zeroBits = function _zeroBits(w) {
                                if (0 === w) return 26;
                                var t = w,
                                    r = 0;
                                return 0 == (8191 & t) && (r += 13, t >>>= 13), 0 == (127 & t) && (r += 7, t >>>= 7), 0 == (15 & t) && (r += 4, t >>>= 4), 0 == (3 & t) && (r += 2, t >>>= 2), 0 == (1 & t) && r++, r
                            }, BN.prototype.bitLength = function bitLength() {
                                var w = this.words[this.length - 1],
                                    hi = this._countBits(w);
                                return 26 * (this.length - 1) + hi
                            }, BN.prototype.zeroBits = function zeroBits() {
                                if (this.isZero()) return 0;
                                for (var r = 0, i = 0, b; i < this.length && (b = this._zeroBits(this.words[i]), r += b, 26 === b); i++);
                                return r
                            }, BN.prototype.byteLength = function byteLength() {
                                return _Mathceil(this.bitLength() / 8)
                            }, BN.prototype.toTwos = function toTwos(width) {
                                return 0 === this.negative ? this.clone() : this.abs().inotn(width).iaddn(1)
                            }, BN.prototype.fromTwos = function fromTwos(width) {
                                return this.testn(width - 1) ? this.notn(width).iaddn(1).ineg() : this.clone()
                            }, BN.prototype.isNeg = function isNeg() {
                                return 0 !== this.negative
                            }, BN.prototype.neg = function neg() {
                                return this.clone().ineg()
                            }, BN.prototype.ineg = function ineg() {
                                return this.isZero() || (this.negative ^= 1), this
                            }, BN.prototype.iuor = function iuor(num) {
                                for (; this.length < num.length;) this.words[this.length++] = 0;
                                for (var i = 0; i < num.length; i++) this.words[i] |= num.words[i];
                                return this.strip()
                            }, BN.prototype.ior = function ior(num) {
                                return assert(0 == (this.negative | num.negative)), this.iuor(num)
                            }, BN.prototype.or = function or(num) {
                                return this.length > num.length ? this.clone().ior(num) : num.clone().ior(this)
                            }, BN.prototype.uor = function uor(num) {
                                return this.length > num.length ? this.clone().iuor(num) : num.clone().iuor(this)
                            }, BN.prototype.iuand = function iuand(num) {
                                var b;
                                b = this.length > num.length ? num : this;
                                for (var i = 0; i < b.length; i++) this.words[i] &= num.words[i];
                                return this.length = b.length, this.strip()
                            }, BN.prototype.iand = function iand(num) {
                                return assert(0 == (this.negative | num.negative)), this.iuand(num)
                            }, BN.prototype.and = function and(num) {
                                return this.length > num.length ? this.clone().iand(num) : num.clone().iand(this)
                            }, BN.prototype.uand = function uand(num) {
                                return this.length > num.length ? this.clone().iuand(num) : num.clone().iuand(this)
                            }, BN.prototype.iuxor = function iuxor(num) {
                                var a, b;
                                this.length > num.length ? (a = this, b = num) : (a = num, b = this);
                                for (var i = 0; i < b.length; i++) this.words[i] = a.words[i] ^ b.words[i];
                                if (this !== a)
                                    for (; i < a.length; i++) this.words[i] = a.words[i];
                                return this.length = a.length, this.strip()
                            }, BN.prototype.ixor = function ixor(num) {
                                return assert(0 == (this.negative | num.negative)), this.iuxor(num)
                            }, BN.prototype.xor = function xor(num) {
                                return this.length > num.length ? this.clone().ixor(num) : num.clone().ixor(this)
                            }, BN.prototype.uxor = function uxor(num) {
                                return this.length > num.length ? this.clone().iuxor(num) : num.clone().iuxor(this)
                            }, BN.prototype.inotn = function inotn(width) {
                                assert("number" == typeof width && 0 <= width);
                                var bytesNeeded = 0 | _Mathceil(width / 26),
                                    bitsLeft = width % 26;
                                this._expand(bytesNeeded), 0 < bitsLeft && bytesNeeded--;
                                for (var i = 0; i < bytesNeeded; i++) this.words[i] = 67108863 & ~this.words[i];
                                return 0 < bitsLeft && (this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft), this.strip()
                            }, BN.prototype.notn = function notn(width) {
                                return this.clone().inotn(width)
                            }, BN.prototype.setn = function setn(bit, val) {
                                assert("number" == typeof bit && 0 <= bit);
                                var off = 0 | bit / 26,
                                    wbit = bit % 26;
                                return this._expand(off + 1), val ? this.words[off] |= 1 << wbit : this.words[off] &= ~(1 << wbit), this.strip()
                            }, BN.prototype.iadd = function iadd(num) {
                                var r;
                                if (0 !== this.negative && 0 === num.negative) return this.negative = 0, r = this.isub(num), this.negative ^= 1, this._normSign();
                                if (0 === this.negative && 0 !== num.negative) return num.negative = 0, r = this.isub(num), num.negative = 1, r._normSign();
                                var a, b;
                                this.length > num.length ? (a = this, b = num) : (a = num, b = this);
                                for (var carry = 0, i = 0; i < b.length; i++) r = (0 | a.words[i]) + (0 | b.words[i]) + carry, this.words[i] = 67108863 & r, carry = r >>> 26;
                                for (; 0 !== carry && i < a.length; i++) r = (0 | a.words[i]) + carry, this.words[i] = 67108863 & r, carry = r >>> 26;
                                if (this.length = a.length, 0 !== carry) this.words[this.length] = carry, this.length++;
                                else if (a !== this)
                                    for (; i < a.length; i++) this.words[i] = a.words[i];
                                return this
                            }, BN.prototype.add = function add(num) {
                                var res;
                                return 0 !== num.negative && 0 === this.negative ? (num.negative = 0, res = this.sub(num), num.negative ^= 1, res) : 0 === num.negative && 0 !== this.negative ? (this.negative = 0, res = num.sub(this), this.negative = 1, res) : this.length > num.length ? this.clone().iadd(num) : num.clone().iadd(this)
                            }, BN.prototype.isub = function isub(num) {
                                if (0 !== num.negative) {
                                    num.negative = 0;
                                    var r = this.iadd(num);
                                    return num.negative = 1, r._normSign()
                                }
                                if (0 !== this.negative) return this.negative = 0, this.iadd(num), this.negative = 1, this._normSign();
                                var cmp = this.cmp(num);
                                if (0 === cmp) return this.negative = 0, this.length = 1, this.words[0] = 0, this;
                                var a, b;
                                0 < cmp ? (a = this, b = num) : (a = num, b = this);
                                for (var carry = 0, i = 0; i < b.length; i++) r = (0 | a.words[i]) - (0 | b.words[i]) + carry, carry = r >> 26, this.words[i] = 67108863 & r;
                                for (; 0 !== carry && i < a.length; i++) r = (0 | a.words[i]) + carry, carry = r >> 26, this.words[i] = 67108863 & r;
                                if (0 === carry && i < a.length && a !== this)
                                    for (; i < a.length; i++) this.words[i] = a.words[i];
                                return this.length = _Mathmax(this.length, i), a !== this && (this.negative = 1), this.strip()
                            }, BN.prototype.sub = function sub(num) {
                                return this.clone().isub(num)
                            };
                            var comb10MulTo = function comb10MulTo(self, num, out) {
                                var a = self.words,
                                    b = num.words,
                                    o = out.words,
                                    c = 0,
                                    a0 = 0 | a[0],
                                    al0 = 8191 & a0,
                                    ah0 = a0 >>> 13,
                                    a1 = 0 | a[1],
                                    al1 = 8191 & a1,
                                    ah1 = a1 >>> 13,
                                    a2 = 0 | a[2],
                                    al2 = 8191 & a2,
                                    ah2 = a2 >>> 13,
                                    a3 = 0 | a[3],
                                    al3 = 8191 & a3,
                                    ah3 = a3 >>> 13,
                                    a4 = 0 | a[4],
                                    al4 = 8191 & a4,
                                    ah4 = a4 >>> 13,
                                    a5 = 0 | a[5],
                                    al5 = 8191 & a5,
                                    ah5 = a5 >>> 13,
                                    a6 = 0 | a[6],
                                    al6 = 8191 & a6,
                                    ah6 = a6 >>> 13,
                                    a7 = 0 | a[7],
                                    al7 = 8191 & a7,
                                    ah7 = a7 >>> 13,
                                    a8 = 0 | a[8],
                                    al8 = 8191 & a8,
                                    ah8 = a8 >>> 13,
                                    a9 = 0 | a[9],
                                    al9 = 8191 & a9,
                                    ah9 = a9 >>> 13,
                                    b0 = 0 | b[0],
                                    bl0 = 8191 & b0,
                                    bh0 = b0 >>> 13,
                                    b1 = 0 | b[1],
                                    bl1 = 8191 & b1,
                                    bh1 = b1 >>> 13,
                                    b2 = 0 | b[2],
                                    bl2 = 8191 & b2,
                                    bh2 = b2 >>> 13,
                                    b3 = 0 | b[3],
                                    bl3 = 8191 & b3,
                                    bh3 = b3 >>> 13,
                                    b4 = 0 | b[4],
                                    bl4 = 8191 & b4,
                                    bh4 = b4 >>> 13,
                                    b5 = 0 | b[5],
                                    bl5 = 8191 & b5,
                                    bh5 = b5 >>> 13,
                                    b6 = 0 | b[6],
                                    bl6 = 8191 & b6,
                                    bh6 = b6 >>> 13,
                                    b7 = 0 | b[7],
                                    bl7 = 8191 & b7,
                                    bh7 = b7 >>> 13,
                                    b8 = 0 | b[8],
                                    bl8 = 8191 & b8,
                                    bh8 = b8 >>> 13,
                                    b9 = 0 | b[9],
                                    bl9 = 8191 & b9,
                                    bh9 = b9 >>> 13,
                                    lo, mid, hi;
                                out.negative = self.negative ^ num.negative, out.length = 19, lo = _Mathimul(al0, bl0), mid = _Mathimul(al0, bh0), mid = 0 | mid + _Mathimul(ah0, bl0), hi = _Mathimul(ah0, bh0);
                                var w0 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w0 >>> 26), w0 &= 67108863, lo = _Mathimul(al1, bl0), mid = _Mathimul(al1, bh0), mid = 0 | mid + _Mathimul(ah1, bl0), hi = _Mathimul(ah1, bh0), lo = 0 | lo + _Mathimul(al0, bl1), mid = 0 | mid + _Mathimul(al0, bh1), mid = 0 | mid + _Mathimul(ah0, bl1), hi = 0 | hi + _Mathimul(ah0, bh1);
                                var w1 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w1 >>> 26), w1 &= 67108863, lo = _Mathimul(al2, bl0), mid = _Mathimul(al2, bh0), mid = 0 | mid + _Mathimul(ah2, bl0), hi = _Mathimul(ah2, bh0), lo = 0 | lo + _Mathimul(al1, bl1), mid = 0 | mid + _Mathimul(al1, bh1), mid = 0 | mid + _Mathimul(ah1, bl1), hi = 0 | hi + _Mathimul(ah1, bh1), lo = 0 | lo + _Mathimul(al0, bl2), mid = 0 | mid + _Mathimul(al0, bh2), mid = 0 | mid + _Mathimul(ah0, bl2), hi = 0 | hi + _Mathimul(ah0, bh2);
                                var w2 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w2 >>> 26), w2 &= 67108863, lo = _Mathimul(al3, bl0), mid = _Mathimul(al3, bh0), mid = 0 | mid + _Mathimul(ah3, bl0), hi = _Mathimul(ah3, bh0), lo = 0 | lo + _Mathimul(al2, bl1), mid = 0 | mid + _Mathimul(al2, bh1), mid = 0 | mid + _Mathimul(ah2, bl1), hi = 0 | hi + _Mathimul(ah2, bh1), lo = 0 | lo + _Mathimul(al1, bl2), mid = 0 | mid + _Mathimul(al1, bh2), mid = 0 | mid + _Mathimul(ah1, bl2), hi = 0 | hi + _Mathimul(ah1, bh2), lo = 0 | lo + _Mathimul(al0, bl3), mid = 0 | mid + _Mathimul(al0, bh3), mid = 0 | mid + _Mathimul(ah0, bl3), hi = 0 | hi + _Mathimul(ah0, bh3);
                                var w3 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w3 >>> 26), w3 &= 67108863, lo = _Mathimul(al4, bl0), mid = _Mathimul(al4, bh0), mid = 0 | mid + _Mathimul(ah4, bl0), hi = _Mathimul(ah4, bh0), lo = 0 | lo + _Mathimul(al3, bl1), mid = 0 | mid + _Mathimul(al3, bh1), mid = 0 | mid + _Mathimul(ah3, bl1), hi = 0 | hi + _Mathimul(ah3, bh1), lo = 0 | lo + _Mathimul(al2, bl2), mid = 0 | mid + _Mathimul(al2, bh2), mid = 0 | mid + _Mathimul(ah2, bl2), hi = 0 | hi + _Mathimul(ah2, bh2), lo = 0 | lo + _Mathimul(al1, bl3), mid = 0 | mid + _Mathimul(al1, bh3), mid = 0 | mid + _Mathimul(ah1, bl3), hi = 0 | hi + _Mathimul(ah1, bh3), lo = 0 | lo + _Mathimul(al0, bl4), mid = 0 | mid + _Mathimul(al0, bh4), mid = 0 | mid + _Mathimul(ah0, bl4), hi = 0 | hi + _Mathimul(ah0, bh4);
                                var w4 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w4 >>> 26), w4 &= 67108863, lo = _Mathimul(al5, bl0), mid = _Mathimul(al5, bh0), mid = 0 | mid + _Mathimul(ah5, bl0), hi = _Mathimul(ah5, bh0), lo = 0 | lo + _Mathimul(al4, bl1), mid = 0 | mid + _Mathimul(al4, bh1), mid = 0 | mid + _Mathimul(ah4, bl1), hi = 0 | hi + _Mathimul(ah4, bh1), lo = 0 | lo + _Mathimul(al3, bl2), mid = 0 | mid + _Mathimul(al3, bh2), mid = 0 | mid + _Mathimul(ah3, bl2), hi = 0 | hi + _Mathimul(ah3, bh2), lo = 0 | lo + _Mathimul(al2, bl3), mid = 0 | mid + _Mathimul(al2, bh3), mid = 0 | mid + _Mathimul(ah2, bl3), hi = 0 | hi + _Mathimul(ah2, bh3), lo = 0 | lo + _Mathimul(al1, bl4), mid = 0 | mid + _Mathimul(al1, bh4), mid = 0 | mid + _Mathimul(ah1, bl4), hi = 0 | hi + _Mathimul(ah1, bh4), lo = 0 | lo + _Mathimul(al0, bl5), mid = 0 | mid + _Mathimul(al0, bh5), mid = 0 | mid + _Mathimul(ah0, bl5), hi = 0 | hi + _Mathimul(ah0, bh5);
                                var w5 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w5 >>> 26), w5 &= 67108863, lo = _Mathimul(al6, bl0), mid = _Mathimul(al6, bh0), mid = 0 | mid + _Mathimul(ah6, bl0), hi = _Mathimul(ah6, bh0), lo = 0 | lo + _Mathimul(al5, bl1), mid = 0 | mid + _Mathimul(al5, bh1), mid = 0 | mid + _Mathimul(ah5, bl1), hi = 0 | hi + _Mathimul(ah5, bh1), lo = 0 | lo + _Mathimul(al4, bl2), mid = 0 | mid + _Mathimul(al4, bh2), mid = 0 | mid + _Mathimul(ah4, bl2), hi = 0 | hi + _Mathimul(ah4, bh2), lo = 0 | lo + _Mathimul(al3, bl3), mid = 0 | mid + _Mathimul(al3, bh3), mid = 0 | mid + _Mathimul(ah3, bl3), hi = 0 | hi + _Mathimul(ah3, bh3), lo = 0 | lo + _Mathimul(al2, bl4), mid = 0 | mid + _Mathimul(al2, bh4), mid = 0 | mid + _Mathimul(ah2, bl4), hi = 0 | hi + _Mathimul(ah2, bh4), lo = 0 | lo + _Mathimul(al1, bl5), mid = 0 | mid + _Mathimul(al1, bh5), mid = 0 | mid + _Mathimul(ah1, bl5), hi = 0 | hi + _Mathimul(ah1, bh5), lo = 0 | lo + _Mathimul(al0, bl6), mid = 0 | mid + _Mathimul(al0, bh6), mid = 0 | mid + _Mathimul(ah0, bl6), hi = 0 | hi + _Mathimul(ah0, bh6);
                                var w6 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w6 >>> 26), w6 &= 67108863, lo = _Mathimul(al7, bl0), mid = _Mathimul(al7, bh0), mid = 0 | mid + _Mathimul(ah7, bl0), hi = _Mathimul(ah7, bh0), lo = 0 | lo + _Mathimul(al6, bl1), mid = 0 | mid + _Mathimul(al6, bh1), mid = 0 | mid + _Mathimul(ah6, bl1), hi = 0 | hi + _Mathimul(ah6, bh1), lo = 0 | lo + _Mathimul(al5, bl2), mid = 0 | mid + _Mathimul(al5, bh2), mid = 0 | mid + _Mathimul(ah5, bl2), hi = 0 | hi + _Mathimul(ah5, bh2), lo = 0 | lo + _Mathimul(al4, bl3), mid = 0 | mid + _Mathimul(al4, bh3), mid = 0 | mid + _Mathimul(ah4, bl3), hi = 0 | hi + _Mathimul(ah4, bh3), lo = 0 | lo + _Mathimul(al3, bl4), mid = 0 | mid + _Mathimul(al3, bh4), mid = 0 | mid + _Mathimul(ah3, bl4), hi = 0 | hi + _Mathimul(ah3, bh4), lo = 0 | lo + _Mathimul(al2, bl5), mid = 0 | mid + _Mathimul(al2, bh5), mid = 0 | mid + _Mathimul(ah2, bl5), hi = 0 | hi + _Mathimul(ah2, bh5), lo = 0 | lo + _Mathimul(al1, bl6), mid = 0 | mid + _Mathimul(al1, bh6), mid = 0 | mid + _Mathimul(ah1, bl6), hi = 0 | hi + _Mathimul(ah1, bh6), lo = 0 | lo + _Mathimul(al0, bl7), mid = 0 | mid + _Mathimul(al0, bh7), mid = 0 | mid + _Mathimul(ah0, bl7), hi = 0 | hi + _Mathimul(ah0, bh7);
                                var w7 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w7 >>> 26), w7 &= 67108863, lo = _Mathimul(al8, bl0), mid = _Mathimul(al8, bh0), mid = 0 | mid + _Mathimul(ah8, bl0), hi = _Mathimul(ah8, bh0), lo = 0 | lo + _Mathimul(al7, bl1), mid = 0 | mid + _Mathimul(al7, bh1), mid = 0 | mid + _Mathimul(ah7, bl1), hi = 0 | hi + _Mathimul(ah7, bh1), lo = 0 | lo + _Mathimul(al6, bl2), mid = 0 | mid + _Mathimul(al6, bh2), mid = 0 | mid + _Mathimul(ah6, bl2), hi = 0 | hi + _Mathimul(ah6, bh2), lo = 0 | lo + _Mathimul(al5, bl3), mid = 0 | mid + _Mathimul(al5, bh3), mid = 0 | mid + _Mathimul(ah5, bl3), hi = 0 | hi + _Mathimul(ah5, bh3), lo = 0 | lo + _Mathimul(al4, bl4), mid = 0 | mid + _Mathimul(al4, bh4), mid = 0 | mid + _Mathimul(ah4, bl4), hi = 0 | hi + _Mathimul(ah4, bh4), lo = 0 | lo + _Mathimul(al3, bl5), mid = 0 | mid + _Mathimul(al3, bh5), mid = 0 | mid + _Mathimul(ah3, bl5), hi = 0 | hi + _Mathimul(ah3, bh5), lo = 0 | lo + _Mathimul(al2, bl6), mid = 0 | mid + _Mathimul(al2, bh6), mid = 0 | mid + _Mathimul(ah2, bl6), hi = 0 | hi + _Mathimul(ah2, bh6), lo = 0 | lo + _Mathimul(al1, bl7), mid = 0 | mid + _Mathimul(al1, bh7), mid = 0 | mid + _Mathimul(ah1, bl7), hi = 0 | hi + _Mathimul(ah1, bh7), lo = 0 | lo + _Mathimul(al0, bl8), mid = 0 | mid + _Mathimul(al0, bh8), mid = 0 | mid + _Mathimul(ah0, bl8), hi = 0 | hi + _Mathimul(ah0, bh8);
                                var w8 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w8 >>> 26), w8 &= 67108863, lo = _Mathimul(al9, bl0), mid = _Mathimul(al9, bh0), mid = 0 | mid + _Mathimul(ah9, bl0), hi = _Mathimul(ah9, bh0), lo = 0 | lo + _Mathimul(al8, bl1), mid = 0 | mid + _Mathimul(al8, bh1), mid = 0 | mid + _Mathimul(ah8, bl1), hi = 0 | hi + _Mathimul(ah8, bh1), lo = 0 | lo + _Mathimul(al7, bl2), mid = 0 | mid + _Mathimul(al7, bh2), mid = 0 | mid + _Mathimul(ah7, bl2), hi = 0 | hi + _Mathimul(ah7, bh2), lo = 0 | lo + _Mathimul(al6, bl3), mid = 0 | mid + _Mathimul(al6, bh3), mid = 0 | mid + _Mathimul(ah6, bl3), hi = 0 | hi + _Mathimul(ah6, bh3), lo = 0 | lo + _Mathimul(al5, bl4), mid = 0 | mid + _Mathimul(al5, bh4), mid = 0 | mid + _Mathimul(ah5, bl4), hi = 0 | hi + _Mathimul(ah5, bh4), lo = 0 | lo + _Mathimul(al4, bl5), mid = 0 | mid + _Mathimul(al4, bh5), mid = 0 | mid + _Mathimul(ah4, bl5), hi = 0 | hi + _Mathimul(ah4, bh5), lo = 0 | lo + _Mathimul(al3, bl6), mid = 0 | mid + _Mathimul(al3, bh6), mid = 0 | mid + _Mathimul(ah3, bl6), hi = 0 | hi + _Mathimul(ah3, bh6), lo = 0 | lo + _Mathimul(al2, bl7), mid = 0 | mid + _Mathimul(al2, bh7), mid = 0 | mid + _Mathimul(ah2, bl7), hi = 0 | hi + _Mathimul(ah2, bh7), lo = 0 | lo + _Mathimul(al1, bl8), mid = 0 | mid + _Mathimul(al1, bh8), mid = 0 | mid + _Mathimul(ah1, bl8), hi = 0 | hi + _Mathimul(ah1, bh8), lo = 0 | lo + _Mathimul(al0, bl9), mid = 0 | mid + _Mathimul(al0, bh9), mid = 0 | mid + _Mathimul(ah0, bl9), hi = 0 | hi + _Mathimul(ah0, bh9);
                                var w9 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w9 >>> 26), w9 &= 67108863, lo = _Mathimul(al9, bl1), mid = _Mathimul(al9, bh1), mid = 0 | mid + _Mathimul(ah9, bl1), hi = _Mathimul(ah9, bh1), lo = 0 | lo + _Mathimul(al8, bl2), mid = 0 | mid + _Mathimul(al8, bh2), mid = 0 | mid + _Mathimul(ah8, bl2), hi = 0 | hi + _Mathimul(ah8, bh2), lo = 0 | lo + _Mathimul(al7, bl3), mid = 0 | mid + _Mathimul(al7, bh3), mid = 0 | mid + _Mathimul(ah7, bl3), hi = 0 | hi + _Mathimul(ah7, bh3), lo = 0 | lo + _Mathimul(al6, bl4), mid = 0 | mid + _Mathimul(al6, bh4), mid = 0 | mid + _Mathimul(ah6, bl4), hi = 0 | hi + _Mathimul(ah6, bh4), lo = 0 | lo + _Mathimul(al5, bl5), mid = 0 | mid + _Mathimul(al5, bh5), mid = 0 | mid + _Mathimul(ah5, bl5), hi = 0 | hi + _Mathimul(ah5, bh5), lo = 0 | lo + _Mathimul(al4, bl6), mid = 0 | mid + _Mathimul(al4, bh6), mid = 0 | mid + _Mathimul(ah4, bl6), hi = 0 | hi + _Mathimul(ah4, bh6), lo = 0 | lo + _Mathimul(al3, bl7), mid = 0 | mid + _Mathimul(al3, bh7), mid = 0 | mid + _Mathimul(ah3, bl7), hi = 0 | hi + _Mathimul(ah3, bh7), lo = 0 | lo + _Mathimul(al2, bl8), mid = 0 | mid + _Mathimul(al2, bh8), mid = 0 | mid + _Mathimul(ah2, bl8), hi = 0 | hi + _Mathimul(ah2, bh8), lo = 0 | lo + _Mathimul(al1, bl9), mid = 0 | mid + _Mathimul(al1, bh9), mid = 0 | mid + _Mathimul(ah1, bl9), hi = 0 | hi + _Mathimul(ah1, bh9);
                                var w10 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w10 >>> 26), w10 &= 67108863, lo = _Mathimul(al9, bl2), mid = _Mathimul(al9, bh2), mid = 0 | mid + _Mathimul(ah9, bl2), hi = _Mathimul(ah9, bh2), lo = 0 | lo + _Mathimul(al8, bl3), mid = 0 | mid + _Mathimul(al8, bh3), mid = 0 | mid + _Mathimul(ah8, bl3), hi = 0 | hi + _Mathimul(ah8, bh3), lo = 0 | lo + _Mathimul(al7, bl4), mid = 0 | mid + _Mathimul(al7, bh4), mid = 0 | mid + _Mathimul(ah7, bl4), hi = 0 | hi + _Mathimul(ah7, bh4), lo = 0 | lo + _Mathimul(al6, bl5), mid = 0 | mid + _Mathimul(al6, bh5), mid = 0 | mid + _Mathimul(ah6, bl5), hi = 0 | hi + _Mathimul(ah6, bh5), lo = 0 | lo + _Mathimul(al5, bl6), mid = 0 | mid + _Mathimul(al5, bh6), mid = 0 | mid + _Mathimul(ah5, bl6), hi = 0 | hi + _Mathimul(ah5, bh6), lo = 0 | lo + _Mathimul(al4, bl7), mid = 0 | mid + _Mathimul(al4, bh7), mid = 0 | mid + _Mathimul(ah4, bl7), hi = 0 | hi + _Mathimul(ah4, bh7), lo = 0 | lo + _Mathimul(al3, bl8), mid = 0 | mid + _Mathimul(al3, bh8), mid = 0 | mid + _Mathimul(ah3, bl8), hi = 0 | hi + _Mathimul(ah3, bh8), lo = 0 | lo + _Mathimul(al2, bl9), mid = 0 | mid + _Mathimul(al2, bh9), mid = 0 | mid + _Mathimul(ah2, bl9), hi = 0 | hi + _Mathimul(ah2, bh9);
                                var w11 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w11 >>> 26), w11 &= 67108863, lo = _Mathimul(al9, bl3), mid = _Mathimul(al9, bh3), mid = 0 | mid + _Mathimul(ah9, bl3), hi = _Mathimul(ah9, bh3), lo = 0 | lo + _Mathimul(al8, bl4), mid = 0 | mid + _Mathimul(al8, bh4), mid = 0 | mid + _Mathimul(ah8, bl4), hi = 0 | hi + _Mathimul(ah8, bh4), lo = 0 | lo + _Mathimul(al7, bl5), mid = 0 | mid + _Mathimul(al7, bh5), mid = 0 | mid + _Mathimul(ah7, bl5), hi = 0 | hi + _Mathimul(ah7, bh5), lo = 0 | lo + _Mathimul(al6, bl6), mid = 0 | mid + _Mathimul(al6, bh6), mid = 0 | mid + _Mathimul(ah6, bl6), hi = 0 | hi + _Mathimul(ah6, bh6), lo = 0 | lo + _Mathimul(al5, bl7), mid = 0 | mid + _Mathimul(al5, bh7), mid = 0 | mid + _Mathimul(ah5, bl7), hi = 0 | hi + _Mathimul(ah5, bh7), lo = 0 | lo + _Mathimul(al4, bl8), mid = 0 | mid + _Mathimul(al4, bh8), mid = 0 | mid + _Mathimul(ah4, bl8), hi = 0 | hi + _Mathimul(ah4, bh8), lo = 0 | lo + _Mathimul(al3, bl9), mid = 0 | mid + _Mathimul(al3, bh9), mid = 0 | mid + _Mathimul(ah3, bl9), hi = 0 | hi + _Mathimul(ah3, bh9);
                                var w12 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w12 >>> 26), w12 &= 67108863, lo = _Mathimul(al9, bl4), mid = _Mathimul(al9, bh4), mid = 0 | mid + _Mathimul(ah9, bl4), hi = _Mathimul(ah9, bh4), lo = 0 | lo + _Mathimul(al8, bl5), mid = 0 | mid + _Mathimul(al8, bh5), mid = 0 | mid + _Mathimul(ah8, bl5), hi = 0 | hi + _Mathimul(ah8, bh5), lo = 0 | lo + _Mathimul(al7, bl6), mid = 0 | mid + _Mathimul(al7, bh6), mid = 0 | mid + _Mathimul(ah7, bl6), hi = 0 | hi + _Mathimul(ah7, bh6), lo = 0 | lo + _Mathimul(al6, bl7), mid = 0 | mid + _Mathimul(al6, bh7), mid = 0 | mid + _Mathimul(ah6, bl7), hi = 0 | hi + _Mathimul(ah6, bh7), lo = 0 | lo + _Mathimul(al5, bl8), mid = 0 | mid + _Mathimul(al5, bh8), mid = 0 | mid + _Mathimul(ah5, bl8), hi = 0 | hi + _Mathimul(ah5, bh8), lo = 0 | lo + _Mathimul(al4, bl9), mid = 0 | mid + _Mathimul(al4, bh9), mid = 0 | mid + _Mathimul(ah4, bl9), hi = 0 | hi + _Mathimul(ah4, bh9);
                                var w13 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w13 >>> 26), w13 &= 67108863, lo = _Mathimul(al9, bl5), mid = _Mathimul(al9, bh5), mid = 0 | mid + _Mathimul(ah9, bl5), hi = _Mathimul(ah9, bh5), lo = 0 | lo + _Mathimul(al8, bl6), mid = 0 | mid + _Mathimul(al8, bh6), mid = 0 | mid + _Mathimul(ah8, bl6), hi = 0 | hi + _Mathimul(ah8, bh6), lo = 0 | lo + _Mathimul(al7, bl7), mid = 0 | mid + _Mathimul(al7, bh7), mid = 0 | mid + _Mathimul(ah7, bl7), hi = 0 | hi + _Mathimul(ah7, bh7), lo = 0 | lo + _Mathimul(al6, bl8), mid = 0 | mid + _Mathimul(al6, bh8), mid = 0 | mid + _Mathimul(ah6, bl8), hi = 0 | hi + _Mathimul(ah6, bh8), lo = 0 | lo + _Mathimul(al5, bl9), mid = 0 | mid + _Mathimul(al5, bh9), mid = 0 | mid + _Mathimul(ah5, bl9), hi = 0 | hi + _Mathimul(ah5, bh9);
                                var w14 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w14 >>> 26), w14 &= 67108863, lo = _Mathimul(al9, bl6), mid = _Mathimul(al9, bh6), mid = 0 | mid + _Mathimul(ah9, bl6), hi = _Mathimul(ah9, bh6), lo = 0 | lo + _Mathimul(al8, bl7), mid = 0 | mid + _Mathimul(al8, bh7), mid = 0 | mid + _Mathimul(ah8, bl7), hi = 0 | hi + _Mathimul(ah8, bh7), lo = 0 | lo + _Mathimul(al7, bl8), mid = 0 | mid + _Mathimul(al7, bh8), mid = 0 | mid + _Mathimul(ah7, bl8), hi = 0 | hi + _Mathimul(ah7, bh8), lo = 0 | lo + _Mathimul(al6, bl9), mid = 0 | mid + _Mathimul(al6, bh9), mid = 0 | mid + _Mathimul(ah6, bl9), hi = 0 | hi + _Mathimul(ah6, bh9);
                                var w15 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w15 >>> 26), w15 &= 67108863, lo = _Mathimul(al9, bl7), mid = _Mathimul(al9, bh7), mid = 0 | mid + _Mathimul(ah9, bl7), hi = _Mathimul(ah9, bh7), lo = 0 | lo + _Mathimul(al8, bl8), mid = 0 | mid + _Mathimul(al8, bh8), mid = 0 | mid + _Mathimul(ah8, bl8), hi = 0 | hi + _Mathimul(ah8, bh8), lo = 0 | lo + _Mathimul(al7, bl9), mid = 0 | mid + _Mathimul(al7, bh9), mid = 0 | mid + _Mathimul(ah7, bl9), hi = 0 | hi + _Mathimul(ah7, bh9);
                                var w16 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w16 >>> 26), w16 &= 67108863, lo = _Mathimul(al9, bl8), mid = _Mathimul(al9, bh8), mid = 0 | mid + _Mathimul(ah9, bl8), hi = _Mathimul(ah9, bh8), lo = 0 | lo + _Mathimul(al8, bl9), mid = 0 | mid + _Mathimul(al8, bh9), mid = 0 | mid + _Mathimul(ah8, bl9), hi = 0 | hi + _Mathimul(ah8, bh9);
                                var w17 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w17 >>> 26), w17 &= 67108863, lo = _Mathimul(al9, bl9), mid = _Mathimul(al9, bh9), mid = 0 | mid + _Mathimul(ah9, bl9), hi = _Mathimul(ah9, bh9);
                                var w18 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                return c = 0 | (0 | hi + (mid >>> 13)) + (w18 >>> 26), w18 &= 67108863, o[0] = w0, o[1] = w1, o[2] = w2, o[3] = w3, o[4] = w4, o[5] = w5, o[6] = w6, o[7] = w7, o[8] = w8, o[9] = w9, o[10] = w10, o[11] = w11, o[12] = w12, o[13] = w13, o[14] = w14, o[15] = w15, o[16] = w16, o[17] = w17, o[18] = w18, 0 !== c && (o[19] = c, out.length++), out
                            };
                            _Mathimul || (comb10MulTo = smallMulTo), BN.prototype.mulTo = function mulTo(num, out) {
                                var len = this.length + num.length,
                                    res;
                                return res = 10 === this.length && 10 === num.length ? comb10MulTo(this, num, out) : 63 > len ? smallMulTo(this, num, out) : 1024 > len ? bigMulTo(this, num, out) : jumboMulTo(this, num, out), res
                            }, FFTM.prototype.makeRBT = function makeRBT(N) {
                                for (var t = Array(N), l = BN.prototype._countBits(N) - 1, i = 0; i < N; i++) t[i] = this.revBin(i, l, N);
                                return t
                            }, FFTM.prototype.revBin = function revBin(x, l, N) {
                                if (0 === x || x === N - 1) return x;
                                for (var rb = 0, i = 0; i < l; i++) rb |= (1 & x) << l - i - 1, x >>= 1;
                                return rb
                            }, FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
                                for (var i = 0; i < N; i++) rtws[i] = rws[rbt[i]], itws[i] = iws[rbt[i]]
                            }, FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
                                this.permute(rbt, rws, iws, rtws, itws, N);
                                for (var s = 1; s < N; s <<= 1)
                                    for (var l = s << 1, rtwdf = _Mathcos(2 * _MathPI / l), itwdf = _Mathsin(2 * _MathPI / l), p = 0; p < N; p += l)
                                        for (var rtwdf_ = rtwdf, itwdf_ = itwdf, j = 0; j < s; j++) {
                                            var re = rtws[p + j],
                                                ie = itws[p + j],
                                                ro = rtws[p + j + s],
                                                io = itws[p + j + s],
                                                rx = rtwdf_ * ro - itwdf_ * io;
                                            io = rtwdf_ * io + itwdf_ * ro, ro = rx, rtws[p + j] = re + ro, itws[p + j] = ie + io, rtws[p + j + s] = re - ro, itws[p + j + s] = ie - io, j !== l && (rx = rtwdf * rtwdf_ - itwdf * itwdf_, itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_, rtwdf_ = rx)
                                        }
                            }, FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
                                var N = 1 | _Mathmax(m, n),
                                    odd = 1 & N,
                                    i = 0;
                                for (N = 0 | N / 2; N; N >>>= 1) i++;
                                return 1 << i + 1 + odd
                            }, FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
                                if (!(1 >= N))
                                    for (var i = 0, t; i < N / 2; i++) t = rws[i], rws[i] = rws[N - i - 1], rws[N - i - 1] = t, t = iws[i], iws[i] = -iws[N - i - 1], iws[N - i - 1] = -t
                            }, FFTM.prototype.normalize13b = function normalize13b(ws, N) {
                                for (var carry = 0, i = 0, w; i < N / 2; i++) w = 8192 * _Mathround(ws[2 * i + 1] / N) + _Mathround(ws[2 * i] / N) + carry, ws[i] = 67108863 & w, carry = 67108864 > w ? 0 : 0 | w / 67108864;
                                return ws
                            }, FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
                                for (var carry = 0, i = 0; i < len; i++) carry += 0 | ws[i], rws[2 * i] = 8191 & carry, carry >>>= 13, rws[2 * i + 1] = 8191 & carry, carry >>>= 13;
                                for (i = 2 * len; i < N; ++i) rws[i] = 0;
                                assert(0 === carry), assert(0 == (-8192 & carry))
                            }, FFTM.prototype.stub = function stub(N) {
                                for (var ph = Array(N), i = 0; i < N; i++) ph[i] = 0;
                                return ph
                            }, FFTM.prototype.mulp = function mulp(x, y, out) {
                                var N = 2 * this.guessLen13b(x.length, y.length),
                                    rbt = this.makeRBT(N),
                                    _ = this.stub(N),
                                    rws = Array(N),
                                    rwst = Array(N),
                                    iwst = Array(N),
                                    nrws = Array(N),
                                    nrwst = Array(N),
                                    niwst = Array(N),
                                    rmws = out.words;
                                rmws.length = N, this.convert13b(x.words, x.length, rws, N), this.convert13b(y.words, y.length, nrws, N), this.transform(rws, _, rwst, iwst, N, rbt), this.transform(nrws, _, nrwst, niwst, N, rbt);
                                for (var i = 0, rx; i < N; i++) rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i], iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i], rwst[i] = rx;
                                return this.conjugate(rwst, iwst, N), this.transform(rwst, iwst, rmws, _, N, rbt), this.conjugate(rmws, _, N), this.normalize13b(rmws, N), out.negative = x.negative ^ y.negative, out.length = x.length + y.length, out.strip()
                            }, BN.prototype.mul = function mul(num) {
                                var out = new BN(null);
                                return out.words = Array(this.length + num.length), this.mulTo(num, out)
                            }, BN.prototype.mulf = function mulf(num) {
                                var out = new BN(null);
                                return out.words = Array(this.length + num.length), jumboMulTo(this, num, out)
                            }, BN.prototype.imul = function imul(num) {
                                return this.clone().mulTo(num, this)
                            }, BN.prototype.imuln = function imuln(num) {
                                assert("number" == typeof num), assert(67108864 > num);
                                for (var carry = 0, i = 0; i < this.length; i++) {
                                    var w = (0 | this.words[i]) * num,
                                        lo = (67108863 & w) + (67108863 & carry);
                                    carry >>= 26, carry += 0 | w / 67108864, carry += lo >>> 26, this.words[i] = 67108863 & lo
                                }
                                return 0 !== carry && (this.words[i] = carry, this.length++), this
                            }, BN.prototype.muln = function muln(num) {
                                return this.clone().imuln(num)
                            }, BN.prototype.sqr = function sqr() {
                                return this.mul(this)
                            }, BN.prototype.isqr = function isqr() {
                                return this.imul(this.clone())
                            }, BN.prototype.pow = function pow(num) {
                                var w = toBitArray(num);
                                if (0 === w.length) return new BN(1);
                                for (var res = this, i = 0; i < w.length && !(0 !== w[i]); i++, res = res.sqr());
                                if (++i < w.length)
                                    for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) 0 !== w[i] && (res = res.mul(q));
                                return res
                            }, BN.prototype.iushln = function iushln(bits) {
                                assert("number" == typeof bits && 0 <= bits);
                                var r = bits % 26,
                                    s = (bits - r) / 26,
                                    carryMask = 67108863 >>> 26 - r << 26 - r,
                                    i;
                                if (0 != r) {
                                    var carry = 0;
                                    for (i = 0; i < this.length; i++) {
                                        var newCarry = this.words[i] & carryMask,
                                            c = (0 | this.words[i]) - newCarry << r;
                                        this.words[i] = c | carry, carry = newCarry >>> 26 - r
                                    }
                                    carry && (this.words[i] = carry, this.length++)
                                }
                                if (0 !== s) {
                                    for (i = this.length - 1; 0 <= i; i--) this.words[i + s] = this.words[i];
                                    for (i = 0; i < s; i++) this.words[i] = 0;
                                    this.length += s
                                }
                                return this.strip()
                            }, BN.prototype.ishln = function ishln(bits) {
                                return assert(0 === this.negative), this.iushln(bits)
                            }, BN.prototype.iushrn = function iushrn(bits, hint, extended) {
                                assert("number" == typeof bits && 0 <= bits);
                                var h;
                                h = hint ? (hint - hint % 26) / 26 : 0;
                                var r = bits % 26,
                                    s = _Mathmin((bits - r) / 26, this.length),
                                    mask = 67108863 ^ 67108863 >>> r << r,
                                    maskedWords = extended;
                                if (h -= s, h = _Mathmax(0, h), maskedWords) {
                                    for (var i = 0; i < s; i++) maskedWords.words[i] = this.words[i];
                                    maskedWords.length = s
                                }
                                if (0 === s);
                                else if (this.length > s)
                                    for (this.length -= s, i = 0; i < this.length; i++) this.words[i] = this.words[i + s];
                                else this.words[0] = 0, this.length = 1;
                                var carry = 0;
                                for (i = this.length - 1; 0 <= i && (0 !== carry || i >= h); i--) {
                                    var word = 0 | this.words[i];
                                    this.words[i] = carry << 26 - r | word >>> r, carry = word & mask
                                }
                                return maskedWords && 0 !== carry && (maskedWords.words[maskedWords.length++] = carry), 0 === this.length && (this.words[0] = 0, this.length = 1), this.strip()
                            }, BN.prototype.ishrn = function ishrn(bits, hint, extended) {
                                return assert(0 === this.negative), this.iushrn(bits, hint, extended)
                            }, BN.prototype.shln = function shln(bits) {
                                return this.clone().ishln(bits)
                            }, BN.prototype.ushln = function ushln(bits) {
                                return this.clone().iushln(bits)
                            }, BN.prototype.shrn = function shrn(bits) {
                                return this.clone().ishrn(bits)
                            }, BN.prototype.ushrn = function ushrn(bits) {
                                return this.clone().iushrn(bits)
                            }, BN.prototype.testn = function testn(bit) {
                                assert("number" == typeof bit && 0 <= bit);
                                var r = bit % 26,
                                    s = (bit - r) / 26,
                                    q = 1 << r;
                                if (this.length <= s) return !1;
                                var w = this.words[s];
                                return !!(w & q)
                            }, BN.prototype.imaskn = function imaskn(bits) {
                                assert("number" == typeof bits && 0 <= bits);
                                var r = bits % 26,
                                    s = (bits - r) / 26;
                                if (assert(0 === this.negative, "imaskn works only with positive numbers"), this.length <= s) return this;
                                if (0 != r && s++, this.length = _Mathmin(s, this.length), 0 != r) {
                                    var mask = 67108863 ^ 67108863 >>> r << r;
                                    this.words[this.length - 1] &= mask
                                }
                                return this.strip()
                            }, BN.prototype.maskn = function maskn(bits) {
                                return this.clone().imaskn(bits)
                            }, BN.prototype.iaddn = function iaddn(num) {
                                return assert("number" == typeof num), assert(67108864 > num), 0 > num ? this.isubn(-num) : 0 === this.negative ? this._iaddn(num) : 1 === this.length && (0 | this.words[0]) < num ? (this.words[0] = num - (0 | this.words[0]), this.negative = 0, this) : (this.negative = 0, this.isubn(num), this.negative = 1, this)
                            }, BN.prototype._iaddn = function _iaddn(num) {
                                this.words[0] += num;
                                for (var i = 0; i < this.length && 67108864 <= this.words[i]; i++) this.words[i] -= 67108864, i == this.length - 1 ? this.words[i + 1] = 1 : this.words[i + 1]++;
                                return this.length = _Mathmax(this.length, i + 1), this
                            }, BN.prototype.isubn = function isubn(num) {
                                if (assert("number" == typeof num), assert(67108864 > num), 0 > num) return this.iaddn(-num);
                                if (0 !== this.negative) return this.negative = 0, this.iaddn(num), this.negative = 1, this;
                                if (this.words[0] -= num, 1 === this.length && 0 > this.words[0]) this.words[0] = -this.words[0], this.negative = 1;
                                else
                                    for (var i = 0; i < this.length && 0 > this.words[i]; i++) this.words[i] += 67108864, this.words[i + 1] -= 1;
                                return this.strip()
                            }, BN.prototype.addn = function addn(num) {
                                return this.clone().iaddn(num)
                            }, BN.prototype.subn = function subn(num) {
                                return this.clone().isubn(num)
                            }, BN.prototype.iabs = function iabs() {
                                return this.negative = 0, this
                            }, BN.prototype.abs = function abs() {
                                return this.clone().iabs()
                            }, BN.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
                                var len = num.length + shift,
                                    i;
                                this._expand(len);
                                var carry = 0,
                                    w;
                                for (i = 0; i < num.length; i++) {
                                    w = (0 | this.words[i + shift]) + carry;
                                    var right = (0 | num.words[i]) * mul;
                                    w -= 67108863 & right, carry = (w >> 26) - (0 | right / 67108864), this.words[i + shift] = 67108863 & w
                                }
                                for (; i < this.length - shift; i++) w = (0 | this.words[i + shift]) + carry, carry = w >> 26, this.words[i + shift] = 67108863 & w;
                                if (0 === carry) return this.strip();
                                for (assert(-1 === carry), carry = 0, i = 0; i < this.length; i++) w = -(0 | this.words[i]) + carry, carry = w >> 26, this.words[i] = 67108863 & w;
                                return this.negative = 1, this.strip()
                            }, BN.prototype._wordDiv = function _wordDiv(num, mode) {
                                var shift = this.length - num.length,
                                    a = this.clone(),
                                    b = num,
                                    bhi = 0 | b.words[b.length - 1],
                                    bhiBits = this._countBits(bhi);
                                shift = 26 - bhiBits, 0 != shift && (b = b.ushln(shift), a.iushln(shift), bhi = 0 | b.words[b.length - 1]);
                                var m = a.length - b.length,
                                    q;
                                if ("mod" !== mode) {
                                    q = new BN(null), q.length = m + 1, q.words = Array(q.length);
                                    for (var i = 0; i < q.length; i++) q.words[i] = 0
                                }
                                var diff = a.clone()._ishlnsubmul(b, 1, m);
                                0 === diff.negative && (a = diff, q && (q.words[m] = 1));
                                for (var j = m - 1, qj; 0 <= j; j--) {
                                    for (qj = 67108864 * (0 | a.words[b.length + j]) + (0 | a.words[b.length + j - 1]), qj = _Mathmin(0 | qj / bhi, 67108863), a._ishlnsubmul(b, qj, j); 0 !== a.negative;) qj--, a.negative = 0, a._ishlnsubmul(b, 1, j), a.isZero() || (a.negative ^= 1);
                                    q && (q.words[j] = qj)
                                }
                                return q && q.strip(), a.strip(), "div" !== mode && 0 !== shift && a.iushrn(shift), {
                                    div: q || null,
                                    mod: a
                                }
                            }, BN.prototype.divmod = function divmod(num, mode, positive) {
                                if (assert(!num.isZero()), this.isZero()) return {
                                    div: new BN(0),
                                    mod: new BN(0)
                                };
                                var div, mod, res;
                                return 0 !== this.negative && 0 === num.negative ? (res = this.neg().divmod(num, mode), "mod" !== mode && (div = res.div.neg()), "div" !== mode && (mod = res.mod.neg(), positive && 0 !== mod.negative && mod.iadd(num)), {
                                    div: div,
                                    mod: mod
                                }) : 0 === this.negative && 0 !== num.negative ? (res = this.divmod(num.neg(), mode), "mod" !== mode && (div = res.div.neg()), {
                                    div: div,
                                    mod: res.mod
                                }) : 0 == (this.negative & num.negative) ? num.length > this.length || 0 > this.cmp(num) ? {
                                    div: new BN(0),
                                    mod: this
                                } : 1 === num.length ? "div" === mode ? {
                                    div: this.divn(num.words[0]),
                                    mod: null
                                } : "mod" === mode ? {
                                    div: null,
                                    mod: new BN(this.modn(num.words[0]))
                                } : {
                                    div: this.divn(num.words[0]),
                                    mod: new BN(this.modn(num.words[0]))
                                } : this._wordDiv(num, mode) : (res = this.neg().divmod(num.neg(), mode), "div" !== mode && (mod = res.mod.neg(), positive && 0 !== mod.negative && mod.isub(num)), {
                                    div: res.div,
                                    mod: mod
                                })
                            }, BN.prototype.div = function div(num) {
                                return this.divmod(num, "div", !1).div
                            }, BN.prototype.mod = function mod(num) {
                                return this.divmod(num, "mod", !1).mod
                            }, BN.prototype.umod = function umod(num) {
                                return this.divmod(num, "mod", !0).mod
                            }, BN.prototype.divRound = function divRound(num) {
                                var dm = this.divmod(num);
                                if (dm.mod.isZero()) return dm.div;
                                var mod = 0 === dm.div.negative ? dm.mod : dm.mod.isub(num),
                                    half = num.ushrn(1),
                                    r2 = num.andln(1),
                                    cmp = mod.cmp(half);
                                return 0 > cmp || 1 === r2 && 0 === cmp ? dm.div : 0 === dm.div.negative ? dm.div.iaddn(1) : dm.div.isubn(1)
                            }, BN.prototype.modn = function modn(num) {
                                assert(67108863 >= num);
                                for (var p = 67108864 % num, acc = 0, i = this.length - 1; 0 <= i; i--) acc = (p * acc + (0 | this.words[i])) % num;
                                return acc
                            }, BN.prototype.idivn = function idivn(num) {
                                assert(67108863 >= num);
                                for (var carry = 0, i = this.length - 1, w; 0 <= i; i--) w = (0 | this.words[i]) + 67108864 * carry, this.words[i] = 0 | w / num, carry = w % num;
                                return this.strip()
                            }, BN.prototype.divn = function divn(num) {
                                return this.clone().idivn(num)
                            }, BN.prototype.egcd = function egcd(p) {
                                assert(0 === p.negative), assert(!p.isZero());
                                var x = this,
                                    y = p.clone();
                                x = 0 === x.negative ? x.clone() : x.umod(p);
                                for (var A = new BN(1), B = new BN(0), C = new BN(0), D = new BN(1), g = 0; x.isEven() && y.isEven();) x.iushrn(1), y.iushrn(1), ++g;
                                for (var yp = y.clone(), xp = x.clone(); !x.isZero();) {
                                    for (var i = 0, im = 1; 0 == (x.words[0] & im) && 26 > i; ++i, im <<= 1);
                                    if (0 < i)
                                        for (x.iushrn(i); 0 < i--;)(A.isOdd() || B.isOdd()) && (A.iadd(yp), B.isub(xp)), A.iushrn(1), B.iushrn(1);
                                    for (var j = 0, jm = 1; 0 == (y.words[0] & jm) && 26 > j; ++j, jm <<= 1);
                                    if (0 < j)
                                        for (y.iushrn(j); 0 < j--;)(C.isOdd() || D.isOdd()) && (C.iadd(yp), D.isub(xp)), C.iushrn(1), D.iushrn(1);
                                    0 <= x.cmp(y) ? (x.isub(y), A.isub(C), B.isub(D)) : (y.isub(x), C.isub(A), D.isub(B))
                                }
                                return {
                                    a: C,
                                    b: D,
                                    gcd: y.iushln(g)
                                }
                            }, BN.prototype._invmp = function _invmp(p) {
                                assert(0 === p.negative), assert(!p.isZero());
                                var a = this,
                                    b = p.clone();
                                a = 0 === a.negative ? a.clone() : a.umod(p);
                                for (var x1 = new BN(1), x2 = new BN(0), delta = b.clone(); 0 < a.cmpn(1) && 0 < b.cmpn(1);) {
                                    for (var i = 0, im = 1; 0 == (a.words[0] & im) && 26 > i; ++i, im <<= 1);
                                    if (0 < i)
                                        for (a.iushrn(i); 0 < i--;) x1.isOdd() && x1.iadd(delta), x1.iushrn(1);
                                    for (var j = 0, jm = 1; 0 == (b.words[0] & jm) && 26 > j; ++j, jm <<= 1);
                                    if (0 < j)
                                        for (b.iushrn(j); 0 < j--;) x2.isOdd() && x2.iadd(delta), x2.iushrn(1);
                                    0 <= a.cmp(b) ? (a.isub(b), x1.isub(x2)) : (b.isub(a), x2.isub(x1))
                                }
                                var res;
                                return res = 0 === a.cmpn(1) ? x1 : x2, 0 > res.cmpn(0) && res.iadd(p), res
                            }, BN.prototype.gcd = function gcd(num) {
                                if (this.isZero()) return num.abs();
                                if (num.isZero()) return this.abs();
                                var a = this.clone(),
                                    b = num.clone();
                                a.negative = 0, b.negative = 0;
                                for (var shift = 0; a.isEven() && b.isEven(); shift++) a.iushrn(1), b.iushrn(1);
                                do {
                                    for (; a.isEven();) a.iushrn(1);
                                    for (; b.isEven();) b.iushrn(1);
                                    var r = a.cmp(b);
                                    if (0 > r) {
                                        var t = a;
                                        a = b, b = t
                                    } else if (0 === r || 0 === b.cmpn(1)) break;
                                    a.isub(b)
                                } while (!0);
                                return b.iushln(shift)
                            }, BN.prototype.invm = function invm(num) {
                                return this.egcd(num).a.umod(num)
                            }, BN.prototype.isEven = function isEven() {
                                return 0 == (1 & this.words[0])
                            }, BN.prototype.isOdd = function isOdd() {
                                return 1 == (1 & this.words[0])
                            }, BN.prototype.andln = function andln(num) {
                                return this.words[0] & num
                            }, BN.prototype.bincn = function bincn(bit) {
                                assert("number" == typeof bit);
                                var r = bit % 26,
                                    s = (bit - r) / 26,
                                    q = 1 << r;
                                if (this.length <= s) return this._expand(s + 1), this.words[s] |= q, this;
                                for (var carry = q, i = s, w; 0 !== carry && i < this.length; i++) w = 0 | this.words[i], w += carry, carry = w >>> 26, w &= 67108863, this.words[i] = w;
                                return 0 !== carry && (this.words[i] = carry, this.length++), this
                            }, BN.prototype.isZero = function isZero() {
                                return 1 === this.length && 0 === this.words[0]
                            }, BN.prototype.cmpn = function cmpn(num) {
                                var negative = 0 > num;
                                if (0 !== this.negative && !negative) return -1;
                                if (0 === this.negative && negative) return 1;
                                this.strip();
                                var res;
                                if (1 < this.length) res = 1;
                                else {
                                    negative && (num = -num), assert(67108863 >= num, "Number is too big");
                                    var w = 0 | this.words[0];
                                    res = w === num ? 0 : w < num ? -1 : 1
                                }
                                return 0 === this.negative ? res : 0 | -res
                            }, BN.prototype.cmp = function cmp(num) {
                                if (0 !== this.negative && 0 === num.negative) return -1;
                                if (0 === this.negative && 0 !== num.negative) return 1;
                                var res = this.ucmp(num);
                                return 0 === this.negative ? res : 0 | -res
                            }, BN.prototype.ucmp = function ucmp(num) {
                                if (this.length > num.length) return 1;
                                if (this.length < num.length) return -1;
                                for (var res = 0, i = this.length - 1; 0 <= i; i--) {
                                    var a = 0 | this.words[i],
                                        b = 0 | num.words[i];
                                    if (a != b) {
                                        a < b ? res = -1 : a > b && (res = 1);
                                        break
                                    }
                                }
                                return res
                            }, BN.prototype.gtn = function gtn(num) {
                                return 1 === this.cmpn(num)
                            }, BN.prototype.gt = function gt(num) {
                                return 1 === this.cmp(num)
                            }, BN.prototype.gten = function gten(num) {
                                return 0 <= this.cmpn(num)
                            }, BN.prototype.gte = function gte(num) {
                                return 0 <= this.cmp(num)
                            }, BN.prototype.ltn = function ltn(num) {
                                return -1 === this.cmpn(num)
                            }, BN.prototype.lt = function lt(num) {
                                return -1 === this.cmp(num)
                            }, BN.prototype.lten = function lten(num) {
                                return 0 >= this.cmpn(num)
                            }, BN.prototype.lte = function lte(num) {
                                return 0 >= this.cmp(num)
                            }, BN.prototype.eqn = function eqn(num) {
                                return 0 === this.cmpn(num)
                            }, BN.prototype.eq = function eq(num) {
                                return 0 === this.cmp(num)
                            }, BN.red = function red(num) {
                                return new Red(num)
                            }, BN.prototype.toRed = function toRed(ctx) {
                                return assert(!this.red, "Already a number in reduction context"), assert(0 === this.negative, "red works only with positives"), ctx.convertTo(this)._forceRed(ctx)
                            }, BN.prototype.fromRed = function fromRed() {
                                return assert(this.red, "fromRed works only with numbers in reduction context"), this.red.convertFrom(this)
                            }, BN.prototype._forceRed = function _forceRed(ctx) {
                                return this.red = ctx, this
                            }, BN.prototype.forceRed = function forceRed(ctx) {
                                return assert(!this.red, "Already a number in reduction context"), this._forceRed(ctx)
                            }, BN.prototype.redAdd = function redAdd(num) {
                                return assert(this.red, "redAdd works only with red numbers"), this.red.add(this, num)
                            }, BN.prototype.redIAdd = function redIAdd(num) {
                                return assert(this.red, "redIAdd works only with red numbers"), this.red.iadd(this, num)
                            }, BN.prototype.redSub = function redSub(num) {
                                return assert(this.red, "redSub works only with red numbers"), this.red.sub(this, num)
                            }, BN.prototype.redISub = function redISub(num) {
                                return assert(this.red, "redISub works only with red numbers"), this.red.isub(this, num)
                            }, BN.prototype.redShl = function redShl(num) {
                                return assert(this.red, "redShl works only with red numbers"), this.red.shl(this, num)
                            }, BN.prototype.redMul = function redMul(num) {
                                return assert(this.red, "redMul works only with red numbers"), this.red._verify2(this, num), this.red.mul(this, num)
                            }, BN.prototype.redIMul = function redIMul(num) {
                                return assert(this.red, "redMul works only with red numbers"), this.red._verify2(this, num), this.red.imul(this, num)
                            }, BN.prototype.redSqr = function redSqr() {
                                return assert(this.red, "redSqr works only with red numbers"), this.red._verify1(this), this.red.sqr(this)
                            }, BN.prototype.redISqr = function redISqr() {
                                return assert(this.red, "redISqr works only with red numbers"), this.red._verify1(this), this.red.isqr(this)
                            }, BN.prototype.redSqrt = function redSqrt() {
                                return assert(this.red, "redSqrt works only with red numbers"), this.red._verify1(this), this.red.sqrt(this)
                            }, BN.prototype.redInvm = function redInvm() {
                                return assert(this.red, "redInvm works only with red numbers"), this.red._verify1(this), this.red.invm(this)
                            }, BN.prototype.redNeg = function redNeg() {
                                return assert(this.red, "redNeg works only with red numbers"), this.red._verify1(this), this.red.neg(this)
                            }, BN.prototype.redPow = function redPow(num) {
                                return assert(this.red && !num.red, "redPow(normalNum)"), this.red._verify1(this), this.red.pow(this, num)
                            };
                            var primes = {
                                k256: null,
                                p224: null,
                                p192: null,
                                p25519: null
                            };
                            MPrime.prototype._tmp = function _tmp() {
                                var tmp = new BN(null);
                                return tmp.words = Array(_Mathceil(this.n / 13)), tmp
                            }, MPrime.prototype.ireduce = function ireduce(num) {
                                var r = num,
                                    rlen;
                                do this.split(r, this.tmp), r = this.imulK(r), r = r.iadd(this.tmp), rlen = r.bitLength(); while (rlen > this.n);
                                var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
                                return 0 === cmp ? (r.words[0] = 0, r.length = 1) : 0 < cmp ? r.isub(this.p) : void 0 === r.strip ? r._strip() : r.strip(), r
                            }, MPrime.prototype.split = function split(input, out) {
                                input.iushrn(this.n, 0, out)
                            }, MPrime.prototype.imulK = function imulK(num) {
                                return num.imul(this.k)
                            }, inherits(K256, MPrime), K256.prototype.split = function split(input, output) {
                                for (var mask = 4194303, outLen = _Mathmin(input.length, 9), i = 0; i < outLen; i++) output.words[i] = input.words[i];
                                if (output.length = outLen, 9 >= input.length) return input.words[0] = 0, void(input.length = 1);
                                var prev = input.words[9];
                                for (output.words[output.length++] = prev & mask, i = 10; i < input.length; i++) {
                                    var next = 0 | input.words[i];
                                    input.words[i - 10] = (next & mask) << 4 | prev >>> 22, prev = next
                                }
                                prev >>>= 22, input.words[i - 10] = prev, input.length -= 0 === prev && 10 < input.length ? 10 : 9
                            }, K256.prototype.imulK = function imulK(num) {
                                num.words[num.length] = 0, num.words[num.length + 1] = 0, num.length += 2;
                                for (var lo = 0, i = 0, w; i < num.length; i++) w = 0 | num.words[i], lo += 977 * w, num.words[i] = 67108863 & lo, lo = 64 * w + (0 | lo / 67108864);
                                return 0 === num.words[num.length - 1] && (num.length--, 0 === num.words[num.length - 1] && num.length--), num
                            }, inherits(P224, MPrime), inherits(P192, MPrime), inherits(P25519, MPrime), P25519.prototype.imulK = function imulK(num) {
                                for (var carry = 0, i = 0; i < num.length; i++) {
                                    var hi = 19 * (0 | num.words[i]) + carry,
                                        lo = 67108863 & hi;
                                    hi >>>= 26, num.words[i] = lo, carry = hi
                                }
                                return 0 !== carry && (num.words[num.length++] = carry), num
                            }, BN._prime = function prime(name) {
                                if (primes[name]) return primes[name];
                                var prime;
                                if ("k256" === name) prime = new K256;
                                else if ("p224" === name) prime = new P224;
                                else if ("p192" === name) prime = new P192;
                                else if ("p25519" === name) prime = new P25519;
                                else throw new Error("Unknown prime " + name);
                                return primes[name] = prime, prime
                            }, Red.prototype._verify1 = function _verify1(a) {
                                assert(0 === a.negative, "red works only with positives"), assert(a.red, "red works only with red numbers")
                            }, Red.prototype._verify2 = function _verify2(a, b) {
                                assert(0 == (a.negative | b.negative), "red works only with positives"), assert(a.red && a.red === b.red, "red works only with red numbers")
                            }, Red.prototype.imod = function imod(a) {
                                return this.prime ? this.prime.ireduce(a)._forceRed(this) : a.umod(this.m)._forceRed(this)
                            }, Red.prototype.neg = function neg(a) {
                                return a.isZero() ? a.clone() : this.m.sub(a)._forceRed(this)
                            }, Red.prototype.add = function add(a, b) {
                                this._verify2(a, b);
                                var res = a.add(b);
                                return 0 <= res.cmp(this.m) && res.isub(this.m), res._forceRed(this)
                            }, Red.prototype.iadd = function iadd(a, b) {
                                this._verify2(a, b);
                                var res = a.iadd(b);
                                return 0 <= res.cmp(this.m) && res.isub(this.m), res
                            }, Red.prototype.sub = function sub(a, b) {
                                this._verify2(a, b);
                                var res = a.sub(b);
                                return 0 > res.cmpn(0) && res.iadd(this.m), res._forceRed(this)
                            }, Red.prototype.isub = function isub(a, b) {
                                this._verify2(a, b);
                                var res = a.isub(b);
                                return 0 > res.cmpn(0) && res.iadd(this.m), res
                            }, Red.prototype.shl = function shl(a, num) {
                                return this._verify1(a), this.imod(a.ushln(num))
                            }, Red.prototype.imul = function imul(a, b) {
                                return this._verify2(a, b), this.imod(a.imul(b))
                            }, Red.prototype.mul = function mul(a, b) {
                                return this._verify2(a, b), this.imod(a.mul(b))
                            }, Red.prototype.isqr = function isqr(a) {
                                return this.imul(a, a.clone())
                            }, Red.prototype.sqr = function sqr(a) {
                                return this.mul(a, a)
                            }, Red.prototype.sqrt = function sqrt(a) {
                                if (a.isZero()) return a.clone();
                                var mod3 = this.m.andln(3);
                                if (assert(1 == mod3 % 2), 3 === mod3) {
                                    var pow = this.m.add(new BN(1)).iushrn(2);
                                    return this.pow(a, pow)
                                }
                                for (var q = this.m.subn(1), s = 0; !q.isZero() && 0 === q.andln(1);) s++, q.iushrn(1);
                                assert(!q.isZero());
                                var one = new BN(1).toRed(this),
                                    nOne = one.redNeg(),
                                    lpow = this.m.subn(1).iushrn(1),
                                    z = this.m.bitLength();
                                for (z = new BN(2 * z * z).toRed(this); 0 !== this.pow(z, lpow).cmp(nOne);) z.redIAdd(nOne);
                                for (var c = this.pow(z, q), r = this.pow(a, q.addn(1).iushrn(1)), t = this.pow(a, q), m = s; 0 !== t.cmp(one);) {
                                    for (var tmp = t, i = 0; 0 !== tmp.cmp(one); i++) tmp = tmp.redSqr();
                                    assert(i < m);
                                    var b = this.pow(c, new BN(1).iushln(m - i - 1));
                                    r = r.redMul(b), c = b.redSqr(), t = t.redMul(c), m = i
                                }
                                return r
                            }, Red.prototype.invm = function invm(a) {
                                var inv = a._invmp(this.m);
                                return 0 === inv.negative ? this.imod(inv) : (inv.negative = 0, this.imod(inv).redNeg())
                            }, Red.prototype.pow = function pow(a, num) {
                                if (num.isZero()) return new BN(1).toRed(this);
                                if (0 === num.cmpn(1)) return a.clone();
                                var windowSize = 4,
                                    wnd = Array(16);
                                wnd[0] = new BN(1).toRed(this), wnd[1] = a;
                                for (var i = 2; i < wnd.length; i++) wnd[i] = this.mul(wnd[i - 1], a);
                                var res = wnd[0],
                                    current = 0,
                                    currentLen = 0,
                                    start = num.bitLength() % 26;
                                for (0 === start && (start = 26), i = num.length - 1; 0 <= i; i--) {
                                    for (var word = num.words[i], j = start - 1, bit; 0 <= j; j--) {
                                        if (bit = 1 & word >> j, res !== wnd[0] && (res = this.sqr(res)), 0 === bit && 0 === current) {
                                            currentLen = 0;
                                            continue
                                        }
                                        current <<= 1, current |= bit, currentLen++, (4 === currentLen || 0 === i && 0 === j) && (res = this.mul(res, wnd[current]), currentLen = 0, current = 0)
                                    }
                                    start = 26
                                }
                                return res
                            }, Red.prototype.convertTo = function convertTo(num) {
                                var r = num.umod(this.m);
                                return r === num ? r.clone() : r
                            }, Red.prototype.convertFrom = function convertFrom(num) {
                                var res = num.clone();
                                return res.red = null, res
                            }, BN.mont = function mont(num) {
                                return new Mont(num)
                            }, inherits(Mont, Red), Mont.prototype.convertTo = function convertTo(num) {
                                return this.imod(num.ushln(this.shift))
                            }, Mont.prototype.convertFrom = function convertFrom(num) {
                                var r = this.imod(num.mul(this.rinv));
                                return r.red = null, r
                            }, Mont.prototype.imul = function imul(a, b) {
                                if (a.isZero() || b.isZero()) return a.words[0] = 0, a.length = 1, a;
                                var t = a.imul(b),
                                    c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
                                    u = t.isub(c).iushrn(this.shift),
                                    res = u;
                                return 0 <= u.cmp(this.m) ? res = u.isub(this.m) : 0 > u.cmpn(0) && (res = u.iadd(this.m)), res._forceRed(this)
                            }, Mont.prototype.mul = function mul(a, b) {
                                if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);
                                var t = a.mul(b),
                                    c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
                                    u = t.isub(c).iushrn(this.shift),
                                    res = u;
                                return 0 <= u.cmp(this.m) ? res = u.isub(this.m) : 0 > u.cmpn(0) && (res = u.iadd(this.m)), res._forceRed(this)
                            }, Mont.prototype.invm = function invm(a) {
                                var res = this.imod(a._invmp(this.m).mul(this.r2));
                                return res._forceRed(this)
                            }
                        })("undefined" == typeof module || module, this)
                    }, {
                        buffer: 42
                    }],
                    23: [function (require, module, exports) {
                        "use strict";

                        function getLens(b64) {
                            var len = b64.length;
                            if (0 < len % 4) throw new Error("Invalid string. Length must be a multiple of 4");
                            var validLen = b64.indexOf("="); - 1 === validLen && (validLen = len);
                            var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
                            return [validLen, placeHoldersLen]
                        }

                        function byteLength(b64) {
                            var lens = getLens(b64),
                                validLen = lens[0],
                                placeHoldersLen = lens[1];
                            return 3 * (validLen + placeHoldersLen) / 4 - placeHoldersLen
                        }

                        function _byteLength(b64, validLen, placeHoldersLen) {
                            return 3 * (validLen + placeHoldersLen) / 4 - placeHoldersLen
                        }

                        function toByteArray(b64) {
                            var lens = getLens(b64),
                                validLen = lens[0],
                                placeHoldersLen = lens[1],
                                arr = new Arr(_byteLength(b64, validLen, placeHoldersLen)),
                                curByte = 0,
                                len = 0 < placeHoldersLen ? validLen - 4 : validLen,
                                tmp, i;
                            for (i = 0; i < len; i += 4) tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)], arr[curByte++] = 255 & tmp >> 16, arr[curByte++] = 255 & tmp >> 8, arr[curByte++] = 255 & tmp;
                            return 2 === placeHoldersLen && (tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4, arr[curByte++] = 255 & tmp), 1 === placeHoldersLen && (tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2, arr[curByte++] = 255 & tmp >> 8, arr[curByte++] = 255 & tmp), arr
                        }

                        function tripletToBase64(num) {
                            return lookup[63 & num >> 18] + lookup[63 & num >> 12] + lookup[63 & num >> 6] + lookup[63 & num]
                        }

                        function encodeChunk(uint8, start, end) {
                            for (var output = [], i = start, tmp; i < end; i += 3) tmp = (16711680 & uint8[i] << 16) + (65280 & uint8[i + 1] << 8) + (255 & uint8[i + 2]), output.push(tripletToBase64(tmp));
                            return output.join("")
                        }

                        function fromByteArray(uint8) {
                            for (var len = uint8.length, extraBytes = len % 3, parts = [], maxChunkLength = 16383, i = 0, len2 = len - extraBytes, tmp; i < len2; i += maxChunkLength) parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
                            return 1 === extraBytes ? (tmp = uint8[len - 1], parts.push(lookup[tmp >> 2] + lookup[63 & tmp << 4] + "==")) : 2 === extraBytes && (tmp = (uint8[len - 2] << 8) + uint8[len - 1], parts.push(lookup[tmp >> 10] + lookup[63 & tmp >> 4] + lookup[63 & tmp << 2] + "=")), parts.join("")
                        }
                        exports.byteLength = byteLength, exports.toByteArray = toByteArray, exports.fromByteArray = fromByteArray;
                        for (var lookup = [], revLookup = [], Arr = "undefined" == typeof Uint8Array ? Array : Uint8Array, code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", i = 0, len = code.length; i < len; ++i) lookup[i] = code[i], revLookup[code.charCodeAt(i)] = i;
                        revLookup[45] = 62, revLookup[95] = 63
                    }, {}],
                    24: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function getIntFromBuffer(buffer, start, end) {
                                    let sum = 0,
                                        sign = 1;
                                    for (let i = start; i < end; i++) {
                                        const num = buffer[i];
                                        if (58 > num && 48 <= num) {
                                            sum = 10 * sum + (num - 48);
                                            continue
                                        }
                                        if (i !== start || 43 !== num) {
                                            if (i === start && 45 === num) {
                                                sign = -1;
                                                continue
                                            }
                                            if (46 === num) break;
                                            throw new Error("not a number: buffer[" + i + "] = " + num)
                                        }
                                    }
                                    return sum * sign
                                }

                                function decode(data, start, end, encoding) {
                                    return null == data || 0 === data.length ? null : ("number" != typeof start && null == encoding && (encoding = start, start = void 0), "number" != typeof end && null == encoding && (encoding = end, end = void 0), decode.position = 0, decode.encoding = encoding || null, decode.data = Buffer.isBuffer(data) ? data.slice(start, end) : Buffer.from(data), decode.bytes = decode.data.length, decode.next())
                                }
                                const INTEGER_START = 105,
                                    STRING_DELIM = 58,
                                    DICTIONARY_START = 100,
                                    LIST_START = 108,
                                    END_OF_TYPE = 101;
                                decode.bytes = 0, decode.position = 0, decode.data = null, decode.encoding = null, decode.next = function () {
                                    switch (decode.data[decode.position]) {
                                        case DICTIONARY_START:
                                            return decode.dictionary();
                                        case LIST_START:
                                            return decode.list();
                                        case INTEGER_START:
                                            return decode.integer();
                                        default:
                                            return decode.buffer();
                                    }
                                }, decode.find = function (chr) {
                                    let i = decode.position;
                                    const c = decode.data.length,
                                        d = decode.data;
                                    for (; i < c;) {
                                        if (d[i] === chr) return i;
                                        i++
                                    }
                                    throw new Error("Invalid data: Missing delimiter \"" + _StringfromCharCode(chr) + "\" [0x" + chr.toString(16) + "]")
                                }, decode.dictionary = function () {
                                    decode.position++;
                                    const dict = {};
                                    for (; decode.data[decode.position] !== END_OF_TYPE;) dict[decode.buffer()] = decode.next();
                                    return decode.position++, dict
                                }, decode.list = function () {
                                    decode.position++;
                                    const lst = [];
                                    for (; decode.data[decode.position] !== END_OF_TYPE;) lst.push(decode.next());
                                    return decode.position++, lst
                                }, decode.integer = function () {
                                    const end = decode.find(END_OF_TYPE),
                                        number = getIntFromBuffer(decode.data, decode.position + 1, end);
                                    return decode.position += end + 1 - decode.position, number
                                }, decode.buffer = function () {
                                    let sep = decode.find(STRING_DELIM);
                                    const length = getIntFromBuffer(decode.data, decode.position, sep),
                                        end = ++sep + length;
                                    return decode.position = end, decode.encoding ? decode.data.toString(decode.encoding, sep, end) : decode.data.slice(sep, end)
                                }, module.exports = decode
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76
                    }],
                    25: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function encode(data, buffer, offset) {
                                    const buffers = [];
                                    let result = null;
                                    return encode._encode(buffers, data), result = Buffer.concat(buffers), encode.bytes = result.length, Buffer.isBuffer(buffer) ? (result.copy(buffer, offset), buffer) : result
                                }
                                const {
                                    getType
                                } = require("./util.js");
                                encode.bytes = -1, encode._floatConversionDetected = !1, encode._encode = function (buffers, data) {
                                    if (null != data) switch (getType(data)) {
                                        case "buffer":
                                            encode.buffer(buffers, data);
                                            break;
                                        case "object":
                                            encode.dict(buffers, data);
                                            break;
                                        case "map":
                                            encode.dictMap(buffers, data);
                                            break;
                                        case "array":
                                            encode.list(buffers, data);
                                            break;
                                        case "set":
                                            encode.listSet(buffers, data);
                                            break;
                                        case "string":
                                            encode.string(buffers, data);
                                            break;
                                        case "number":
                                            encode.number(buffers, data);
                                            break;
                                        case "boolean":
                                            encode.number(buffers, data);
                                            break;
                                        case "arraybufferview":
                                            encode.buffer(buffers, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
                                            break;
                                        case "arraybuffer":
                                            encode.buffer(buffers, Buffer.from(data));
                                    }
                                };
                                const buffE = Buffer.from("e"),
                                    buffD = Buffer.from("d"),
                                    buffL = Buffer.from("l");
                                encode.buffer = function (buffers, data) {
                                    buffers.push(Buffer.from(data.length + ":"), data)
                                }, encode.string = function (buffers, data) {
                                    buffers.push(Buffer.from(Buffer.byteLength(data) + ":" + data))
                                }, encode.number = function (buffers, data) {
                                    const maxLo = 2147483648,
                                        hi = data / 2147483648 << 0,
                                        lo = data % 2147483648 << 0,
                                        val = hi * 2147483648 + lo;
                                    buffers.push(Buffer.from("i" + val + "e")), val === data || encode._floatConversionDetected || (encode._floatConversionDetected = !0, console.warn("WARNING: Possible data corruption detected with value \"" + data + "\":", "Bencoding only defines support for integers, value was converted to \"" + val + "\""), console.trace())
                                }, encode.dict = function (buffers, data) {
                                    buffers.push(buffD);
                                    let j = 0,
                                        k;
                                    const keys = Object.keys(data).sort(),
                                        kl = keys.length;
                                    for (; j < kl; j++) k = keys[j], null != data[k] && (encode.string(buffers, k), encode._encode(buffers, data[k]));
                                    buffers.push(buffE)
                                }, encode.dictMap = function (buffers, data) {
                                    buffers.push(buffD);
                                    const keys = Array.from(data.keys()).sort();
                                    for (const key of keys) null != data.get(key) && (Buffer.isBuffer(key) ? encode._encode(buffers, key) : encode.string(buffers, key + ""), encode._encode(buffers, data.get(key)));
                                    buffers.push(buffE)
                                }, encode.list = function (buffers, data) {
                                    let i = 0;
                                    const c = data.length;
                                    for (buffers.push(buffL); i < c; i++) null != data[i] && encode._encode(buffers, data[i]);
                                    buffers.push(buffE)
                                }, encode.listSet = function (buffers, data) {
                                    buffers.push(buffL);
                                    for (const item of data) null != item && encode._encode(buffers, item);
                                    buffers.push(buffE)
                                }, module.exports = encode
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        "./util.js": 28,
                        buffer: 76
                    }],
                    26: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function listLength(list) {
                                    let length = 2;
                                    for (const value of list) length += encodingLength(value);
                                    return length
                                }

                                function mapLength(map) {
                                    let length = 2;
                                    for (const [key, value] of map) {
                                        const keyLength = Buffer.byteLength(key);
                                        length += digitCount(keyLength) + 1 + keyLength, length += encodingLength(value)
                                    }
                                    return length
                                }

                                function objectLength(value) {
                                    let length = 2;
                                    const keys = Object.keys(value);
                                    for (let i = 0; i < keys.length; i++) {
                                        const keyLength = Buffer.byteLength(keys[i]);
                                        length += digitCount(keyLength) + 1 + keyLength, length += encodingLength(value[keys[i]])
                                    }
                                    return length
                                }

                                function stringLength(value) {
                                    const length = Buffer.byteLength(value);
                                    return digitCount(length) + 1 + length
                                }

                                function arrayBufferLength(value) {
                                    const length = value.byteLength - value.byteOffset;
                                    return digitCount(length) + 1 + length
                                }

                                function encodingLength(value) {
                                    const length = 0;
                                    if (null == value) return 0;
                                    const type = getType(value);
                                    switch (type) {
                                        case "buffer":
                                            return digitCount(value.length) + 1 + value.length;
                                        case "arraybufferview":
                                            return arrayBufferLength(value);
                                        case "string":
                                            return stringLength(value);
                                        case "array":
                                        case "set":
                                            return listLength(value);
                                        case "number":
                                            return 1 + digitCount(_Mathfloor(value)) + 1;
                                        case "bigint":
                                            return 1 + value.toString().length + 1;
                                        case "object":
                                            return objectLength(value);
                                        case "map":
                                            return mapLength(value);
                                        default:
                                            throw new TypeError(`Unsupported value of type "${type}"`);
                                    }
                                }
                                const {
                                    digitCount,
                                    getType
                                } = require("./util.js");
                                module.exports = encodingLength
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        "./util.js": 28,
                        buffer: 76
                    }],
                    27: [function (require, module, exports) {
                        const bencode = module.exports;
                        bencode.encode = require("./encode.js"), bencode.decode = require("./decode.js"), bencode.byteLength = bencode.encodingLength = require("./encoding-length.js")
                    }, {
                        "./decode.js": 24,
                        "./encode.js": 25,
                        "./encoding-length.js": 26
                    }],
                    28: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                const util = module.exports;
                                util.digitCount = function digitCount(value) {
                                    var _Mathlog = Math.log10;
                                    const sign = 0 > value ? 1 : 0;
                                    return value = _Mathabs(+(value || 1)), _Mathfloor(_Mathlog(value)) + 1 + sign
                                }, util.getType = function getType(value) {
                                    return Buffer.isBuffer(value) ? "buffer" : ArrayBuffer.isView(value) ? "arraybufferview" : Array.isArray(value) ? "array" : value instanceof Number ? "number" : value instanceof Boolean ? "boolean" : value instanceof Set ? "set" : value instanceof Map ? "map" : value instanceof String ? "string" : value instanceof ArrayBuffer ? "arraybuffer" : typeof value
                                }
                            }).call(this)
                        }).call(this, {
                            isBuffer: require("../../is-buffer/index.js")
                        })
                    }, {
                        "../../is-buffer/index.js": 149
                    }],
                    29: [function (require, module, exports) {
                        function composeRange(range) {
                            return range.reduce((acc, cur, idx, arr) => ((0 === idx || cur !== arr[idx - 1] + 1) && acc.push([]), acc[acc.length - 1].push(cur), acc), []).map(cur => 1 < cur.length ? `${cur[0]}-${cur[cur.length-1]}` : `${cur[0]}`)
                        }

                        function parseRange(range) {
                            const generateRange = (start, end = start) => Array.from({
                                length: end - start + 1
                            }, (cur, idx) => idx + start);
                            return range.reduce((acc, cur, idx, arr) => {
                                const r = cur.split("-").map(cur => parseInt(cur));
                                return acc.concat(generateRange(...r))
                            }, [])
                        }
                        module.exports = parseRange, module.exports.parse = parseRange, module.exports.compose = composeRange
                    }, {}],
                    30: [function (require, module, exports) {
                        module.exports = function (haystack, needle, comparator, low, high) {
                            var mid, cmp;
                            if (void 0 === low) low = 0;
                            else if (low |= 0, 0 > low || low >= haystack.length) throw new RangeError("invalid lower bound");
                            if (void 0 === high) high = haystack.length - 1;
                            else if (high |= 0, high < low || high >= haystack.length) throw new RangeError("invalid upper bound");
                            for (; low <= high;)
                                if (mid = low + (high - low >>> 1), cmp = +comparator(haystack[mid], needle, mid, haystack), 0 > cmp) low = mid + 1;
                                else if (0 < cmp) high = mid - 1;
                            else return mid;
                            return ~low
                        }
                    }, {}],
                    31: [function (require, module, exports) {
                        "use strict";

                        function getByteSize(num) {
                            var out = num >> 3;
                            return 0 != num % 8 && out++, out
                        }
                        Object.defineProperty(exports, "__esModule", {
                            value: !0
                        });
                        var BitField = function () {
                            function BitField(data, opts) {
                                void 0 === data && (data = 0);
                                var grow = null === opts || void 0 === opts ? void 0 : opts.grow;
                                this.grow = grow && isFinite(grow) && getByteSize(grow) || grow || 0, this.buffer = "number" == typeof data ? new Uint8Array(getByteSize(data)) : data
                            }
                            return BitField.prototype.get = function (i) {
                                var j = i >> 3;
                                return j < this.buffer.length && !!(this.buffer[j] & 128 >> i % 8)
                            }, BitField.prototype.set = function (i, value) {
                                void 0 === value && (value = !0);
                                var j = i >> 3;
                                if (value) {
                                    if (this.buffer.length < j + 1) {
                                        var length = _Mathmax(j + 1, _Mathmin(2 * this.buffer.length, this.grow));
                                        if (length <= this.grow) {
                                            var newBuffer = new Uint8Array(length);
                                            newBuffer.set(this.buffer), this.buffer = newBuffer
                                        }
                                    }
                                    this.buffer[j] |= 128 >> i % 8
                                } else j < this.buffer.length && (this.buffer[j] &= ~(128 >> i % 8))
                            }, BitField.prototype.forEach = function (fn, start, end) {
                                void 0 === start && (start = 0), void 0 === end && (end = 8 * this.buffer.length);
                                for (var i = start, j = i >> 3, y = 128 >> i % 8, byte = this.buffer[j]; i < end; i++) fn(!!(byte & y), i), y = 1 == y ? (byte = this.buffer[++j], 128) : y >> 1
                            }, BitField
                        }();
                        exports.default = BitField
                    }, {}],
                    32: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function xor(a, b) {
                                    for (let len = a.length; len--;) a[len] ^= b[len];
                                    return a
                                } /*! bittorrent-protocol. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
                                const arrayRemove = require("unordered-array-remove"),
                                    bencode = require("bencode"),
                                    BitField = require("bitfield").default,
                                    crypto = require("crypto"),
                                    debug = require("debug")("bittorrent-protocol"),
                                    randombytes = require("randombytes"),
                                    sha1 = require("simple-sha1"),
                                    speedometer = require("speedometer"),
                                    stream = require("readable-stream"),
                                    RC4 = require("rc4"),
                                    BITFIELD_GROW = 4e5,
                                    KEEP_ALIVE_TIMEOUT = 55e3,
                                    ALLOWED_FAST_SET_MAX_LENGTH = 100,
                                    MESSAGE_PROTOCOL = Buffer.from("\x13BitTorrent protocol"),
                                    MESSAGE_KEEP_ALIVE = Buffer.from([0, 0, 0, 0]),
                                    MESSAGE_CHOKE = Buffer.from([0, 0, 0, 1, 0]),
                                    MESSAGE_UNCHOKE = Buffer.from([0, 0, 0, 1, 1]),
                                    MESSAGE_INTERESTED = Buffer.from([0, 0, 0, 1, 2]),
                                    MESSAGE_UNINTERESTED = Buffer.from([0, 0, 0, 1, 3]),
                                    MESSAGE_RESERVED = [0, 0, 0, 0, 0, 0, 0, 0],
                                    MESSAGE_PORT = [0, 0, 0, 3, 9, 0, 0],
                                    MESSAGE_HAVE_ALL = Buffer.from([0, 0, 0, 1, 14]),
                                    MESSAGE_HAVE_NONE = Buffer.from([0, 0, 0, 1, 15]),
                                    DH_PRIME = "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a63a36210000000000090563",
                                    DH_GENERATOR = 2,
                                    VC = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
                                    CRYPTO_PROVIDE = Buffer.from([0, 0, 1, 2]),
                                    CRYPTO_SELECT = Buffer.from([0, 0, 0, 2]);
                                class Request {
                                    constructor(piece, offset, length, callback) {
                                        this.piece = piece, this.offset = offset, this.length = length, this.callback = callback
                                    }
                                }
                                class HaveAllBitField {
                                    constructor() {
                                        this.buffer = new Uint8Array
                                    }
                                    get(index) {
                                        return !0
                                    }
                                    set(index) {}
                                }
                                class Wire extends stream.Duplex {
                                    constructor(type = null, retries = 0, peEnabled = !1) {
                                        super(), this._debugId = randombytes(4).toString("hex"), this._debug("new wire"), this.peerId = null, this.peerIdBuffer = null, this.type = type, this.amChoking = !0, this.amInterested = !1, this.peerChoking = !0, this.peerInterested = !1, this.peerPieces = new BitField(0, {
                                            grow: BITFIELD_GROW
                                        }), this.extensions = {}, this.peerExtensions = {}, this.requests = [], this.peerRequests = [], this.extendedMapping = {}, this.peerExtendedMapping = {}, this.extendedHandshake = {}, this.peerExtendedHandshake = {}, this.hasFast = !1, this.allowedFastSet = [], this.peerAllowedFastSet = [], this._ext = {}, this._nextExt = 1, this.uploaded = 0, this.downloaded = 0, this.uploadSpeed = speedometer(), this.downloadSpeed = speedometer(), this._keepAliveInterval = null, this._timeout = null, this._timeoutMs = 0, this._timeoutExpiresAt = null, this.destroyed = !1, this._finished = !1, this._parserSize = 0, this._parser = null, this._buffer = [], this._bufferSize = 0, this._peEnabled = peEnabled, peEnabled ? (this._dh = crypto.createDiffieHellman(DH_PRIME, "hex", DH_GENERATOR), this._myPubKey = this._dh.generateKeys("hex")) : this._myPubKey = null, this._peerPubKey = null, this._sharedSecret = null, this._peerCryptoProvide = [], this._cryptoHandshakeDone = !1, this._cryptoSyncPattern = null, this._waitMaxBytes = null, this._encryptionMethod = null, this._encryptGenerator = null, this._decryptGenerator = null, this._setGenerators = !1, this.once("finish", () => this._onFinish()), this.on("finish", this._onFinish), this._debug("type:", this.type), "tcpIncoming" === this.type && this._peEnabled ? this._determineHandshakeType() : "tcpOutgoing" === this.type && this._peEnabled && 0 === retries ? this._parsePe2() : this._parseHandshake(null)
                                    }
                                    setKeepAlive(enable) {
                                        this._debug("setKeepAlive %s", enable), clearInterval(this._keepAliveInterval);
                                        !1 === enable || (this._keepAliveInterval = setInterval(() => {
                                            this.keepAlive()
                                        }, KEEP_ALIVE_TIMEOUT))
                                    }
                                    setTimeout(ms, unref) {
                                        this._debug("setTimeout ms=%d unref=%s", ms, unref), this._timeoutMs = ms, this._timeoutUnref = !!unref, this._resetTimeout(!0)
                                    }
                                    destroy() {
                                        if (!this.destroyed) return this.destroyed = !0, this._debug("destroy"), this.emit("close"), this.end(), this
                                    }
                                    end(...args) {
                                        return this._debug("end"), this._onUninterested(), this._onChoke(), super.end(...args)
                                    }
                                    use(Extension) {
                                        function noop() {}
                                        const name = Extension.prototype.name;
                                        if (!name) throw new Error("Extension class requires a \"name\" property on the prototype");
                                        this._debug("use extension.name=%s", name);
                                        const ext = this._nextExt,
                                            handler = new Extension(this);
                                        "function" != typeof handler.onHandshake && (handler.onHandshake = noop), "function" != typeof handler.onExtendedHandshake && (handler.onExtendedHandshake = noop), "function" != typeof handler.onMessage && (handler.onMessage = noop), this.extendedMapping[ext] = name, this._ext[name] = handler, this[name] = handler, this._nextExt += 1
                                    }
                                    keepAlive() {
                                        this._debug("keep-alive"), this._push(MESSAGE_KEEP_ALIVE)
                                    }
                                    sendPe1() {
                                        if (this._peEnabled) {
                                            const padALen = _Mathfloor(513 * Math.random()),
                                                padA = randombytes(padALen);
                                            this._push(Buffer.concat([Buffer.from(this._myPubKey, "hex"), padA]))
                                        }
                                    }
                                    sendPe2() {
                                        const padBLen = _Mathfloor(513 * Math.random()),
                                            padB = randombytes(padBLen);
                                        this._push(Buffer.concat([Buffer.from(this._myPubKey, "hex"), padB]))
                                    }
                                    sendPe3(infoHash) {
                                        this.setEncrypt(this._sharedSecret, infoHash);
                                        const hash1Buffer = Buffer.from(sha1.sync(Buffer.from(this._utfToHex("req1") + this._sharedSecret, "hex")), "hex"),
                                            hash2Buffer = Buffer.from(sha1.sync(Buffer.from(this._utfToHex("req2") + infoHash, "hex")), "hex"),
                                            hash3Buffer = Buffer.from(sha1.sync(Buffer.from(this._utfToHex("req3") + this._sharedSecret, "hex")), "hex"),
                                            hashesXorBuffer = xor(hash2Buffer, hash3Buffer),
                                            padCLen = randombytes(2).readUInt16BE(0) % 512,
                                            padCBuffer = randombytes(padCLen);
                                        let vcAndProvideBuffer = Buffer.alloc(14 + padCLen + 2);
                                        VC.copy(vcAndProvideBuffer), CRYPTO_PROVIDE.copy(vcAndProvideBuffer, 8), vcAndProvideBuffer.writeInt16BE(padCLen, 12), padCBuffer.copy(vcAndProvideBuffer, 14), vcAndProvideBuffer.writeInt16BE(0, 14 + padCLen), vcAndProvideBuffer = this._encryptHandshake(vcAndProvideBuffer), this._push(Buffer.concat([hash1Buffer, hashesXorBuffer, vcAndProvideBuffer]))
                                    }
                                    sendPe4(infoHash) {
                                        this.setEncrypt(this._sharedSecret, infoHash);
                                        const padDLen = randombytes(2).readUInt16BE(0) % 512,
                                            padDBuffer = randombytes(padDLen);
                                        let vcAndSelectBuffer = Buffer.alloc(14 + padDLen);
                                        VC.copy(vcAndSelectBuffer), CRYPTO_SELECT.copy(vcAndSelectBuffer, 8), vcAndSelectBuffer.writeInt16BE(padDLen, 12), padDBuffer.copy(vcAndSelectBuffer, 14), vcAndSelectBuffer = this._encryptHandshake(vcAndSelectBuffer), this._push(vcAndSelectBuffer), this._cryptoHandshakeDone = !0, this._debug("completed crypto handshake")
                                    }
                                    handshake(infoHash, peerId, extensions) {
                                        let infoHashBuffer, peerIdBuffer;
                                        if ("string" == typeof infoHash ? (infoHash = infoHash.toLowerCase(), infoHashBuffer = Buffer.from(infoHash, "hex")) : (infoHashBuffer = infoHash, infoHash = infoHashBuffer.toString("hex")), "string" == typeof peerId ? peerIdBuffer = Buffer.from(peerId, "hex") : (peerIdBuffer = peerId, peerId = peerIdBuffer.toString("hex")), this._infoHash = infoHashBuffer, 20 !== infoHashBuffer.length || 20 !== peerIdBuffer.length) throw new Error("infoHash and peerId MUST have length 20");
                                        this._debug("handshake i=%s p=%s exts=%o", infoHash, peerId, extensions);
                                        const reserved = Buffer.from(MESSAGE_RESERVED);
                                        this.extensions = {
                                            extended: !0,
                                            dht: !!(extensions && extensions.dht),
                                            fast: !!(extensions && extensions.fast)
                                        }, reserved[5] |= 16, this.extensions.dht && (reserved[7] |= 1), this.extensions.fast && (reserved[7] |= 4), this.extensions.fast && this.peerExtensions.fast && (this._debug("fast extension is enabled"), this.hasFast = !0), this._push(Buffer.concat([MESSAGE_PROTOCOL, reserved, infoHashBuffer, peerIdBuffer])), this._handshakeSent = !0, this.peerExtensions.extended && !this._extendedHandshakeSent && this._sendExtendedHandshake()
                                    }
                                    _sendExtendedHandshake() {
                                        const msg = Object.assign({}, this.extendedHandshake);
                                        for (const ext in msg.m = {}, this.extendedMapping) {
                                            const name = this.extendedMapping[ext];
                                            msg.m[name] = +ext
                                        }
                                        this.extended(0, bencode.encode(msg)), this._extendedHandshakeSent = !0
                                    }
                                    choke() {
                                        if (!this.amChoking)
                                            if (this.amChoking = !0, this._debug("choke"), this._push(MESSAGE_CHOKE), this.hasFast)
                                                for (let allowedCount = 0; this.peerRequests.length > allowedCount;) {
                                                    const request = this.peerRequests[allowedCount];
                                                    this.allowedFastSet.includes(request.piece) ? ++allowedCount : this.reject(request.piece, request.offset, request.length)
                                                } else
                                                    for (; this.peerRequests.length;) this.peerRequests.pop()
                                    }
                                    unchoke() {
                                        this.amChoking && (this.amChoking = !1, this._debug("unchoke"), this._push(MESSAGE_UNCHOKE))
                                    }
                                    interested() {
                                        this.amInterested || (this.amInterested = !0, this._debug("interested"), this._push(MESSAGE_INTERESTED))
                                    }
                                    uninterested() {
                                        this.amInterested && (this.amInterested = !1, this._debug("uninterested"), this._push(MESSAGE_UNINTERESTED))
                                    }
                                    have(index) {
                                        this._debug("have %d", index), this._message(4, [index], null)
                                    }
                                    bitfield(bitfield) {
                                        this._debug("bitfield"), Buffer.isBuffer(bitfield) || (bitfield = bitfield.buffer), this._message(5, [], bitfield)
                                    }
                                    request(index, offset, length, cb) {
                                        return cb || (cb = () => {}), this._finished ? cb(new Error("wire is closed")) : this.peerChoking && !(this.hasFast && this.peerAllowedFastSet.includes(index)) ? cb(new Error("peer is choking")) : void(this._debug("request index=%d offset=%d length=%d", index, offset, length), this.requests.push(new Request(index, offset, length, cb)), !this._timeout && this._resetTimeout(!0), this._message(6, [index, offset, length], null))
                                    }
                                    piece(index, offset, buffer) {
                                        this._debug("piece index=%d offset=%d", index, offset), this._message(7, [index, offset], buffer), this.uploaded += buffer.length, this.uploadSpeed(buffer.length), this.emit("upload", buffer.length)
                                    }
                                    cancel(index, offset, length) {
                                        this._debug("cancel index=%d offset=%d length=%d", index, offset, length), this._callback(this._pull(this.requests, index, offset, length), new Error("request was cancelled"), null), this._message(8, [index, offset, length], null)
                                    }
                                    port(port) {
                                        this._debug("port %d", port);
                                        const message = Buffer.from(MESSAGE_PORT);
                                        message.writeUInt16BE(port, 5), this._push(message)
                                    }
                                    suggest(index) {
                                        if (!this.hasFast) throw Error("fast extension is disabled");
                                        this._debug("suggest %d", index), this._message(13, [index], null)
                                    }
                                    haveAll() {
                                        if (!this.hasFast) throw Error("fast extension is disabled");
                                        this._debug("have-all"), this._push(MESSAGE_HAVE_ALL)
                                    }
                                    haveNone() {
                                        if (!this.hasFast) throw Error("fast extension is disabled");
                                        this._debug("have-none"), this._push(MESSAGE_HAVE_NONE)
                                    }
                                    reject(index, offset, length) {
                                        if (!this.hasFast) throw Error("fast extension is disabled");
                                        this._debug("reject index=%d offset=%d length=%d", index, offset, length), this._pull(this.peerRequests, index, offset, length), this._message(16, [index, offset, length], null)
                                    }
                                    allowedFast(index) {
                                        if (!this.hasFast) throw Error("fast extension is disabled");
                                        this._debug("allowed-fast %d", index), this.allowedFastSet.includes(index) || this.allowedFastSet.push(index), this._message(17, [index], null)
                                    }
                                    extended(ext, obj) {
                                        if (this._debug("extended ext=%s", ext), "string" == typeof ext && this.peerExtendedMapping[ext] && (ext = this.peerExtendedMapping[ext]), "number" == typeof ext) {
                                            const extId = Buffer.from([ext]),
                                                buf = Buffer.isBuffer(obj) ? obj : bencode.encode(obj);
                                            this._message(20, [], Buffer.concat([extId, buf]))
                                        } else throw new Error(`Unrecognized extension: ${ext}`)
                                    }
                                    setEncrypt(sharedSecret, infoHash) {
                                        let encryptKey, decryptKey, encryptKeyBuf, encryptKeyIntArray, decryptKeyBuf, decryptKeyIntArray;
                                        switch (this.type) {
                                            case "tcpIncoming":
                                                encryptKey = sha1.sync(Buffer.from(this._utfToHex("keyB") + sharedSecret + infoHash, "hex")), decryptKey = sha1.sync(Buffer.from(this._utfToHex("keyA") + sharedSecret + infoHash, "hex")), encryptKeyBuf = Buffer.from(encryptKey, "hex"), encryptKeyIntArray = [];
                                                for (const value of encryptKeyBuf.values()) encryptKeyIntArray.push(value);
                                                decryptKeyBuf = Buffer.from(decryptKey, "hex"), decryptKeyIntArray = [];
                                                for (const value of decryptKeyBuf.values()) decryptKeyIntArray.push(value);
                                                this._encryptGenerator = new RC4(encryptKeyIntArray), this._decryptGenerator = new RC4(decryptKeyIntArray);
                                                break;
                                            case "tcpOutgoing":
                                                encryptKey = sha1.sync(Buffer.from(this._utfToHex("keyA") + sharedSecret + infoHash, "hex")), decryptKey = sha1.sync(Buffer.from(this._utfToHex("keyB") + sharedSecret + infoHash, "hex")), encryptKeyBuf = Buffer.from(encryptKey, "hex"), encryptKeyIntArray = [];
                                                for (const value of encryptKeyBuf.values()) encryptKeyIntArray.push(value);
                                                decryptKeyBuf = Buffer.from(decryptKey, "hex"), decryptKeyIntArray = [];
                                                for (const value of decryptKeyBuf.values()) decryptKeyIntArray.push(value);
                                                this._encryptGenerator = new RC4(encryptKeyIntArray), this._decryptGenerator = new RC4(decryptKeyIntArray);
                                                break;
                                            default:
                                                return !1;
                                        }
                                        for (let i = 0; 1024 > i; i++) this._encryptGenerator.randomByte(), this._decryptGenerator.randomByte();
                                        return this._setGenerators = !0, !0
                                    }
                                    _read() {}
                                    _message(id, numbers, data) {
                                        const dataLength = data ? data.length : 0,
                                            buffer = Buffer.allocUnsafe(5 + 4 * numbers.length);
                                        buffer.writeUInt32BE(buffer.length + dataLength - 4, 0), buffer[4] = id;
                                        for (let i = 0; i < numbers.length; i++) buffer.writeUInt32BE(numbers[i], 5 + 4 * i);
                                        this._push(buffer), data && this._push(data)
                                    }
                                    _push(data) {
                                        if (!this._finished) return 2 === this._encryptionMethod && this._cryptoHandshakeDone && (data = this._encrypt(data)), this.push(data)
                                    }
                                    _onKeepAlive() {
                                        this._debug("got keep-alive"), this.emit("keep-alive")
                                    }
                                    _onPe1(pubKeyBuffer) {
                                        this._peerPubKey = pubKeyBuffer.toString("hex"), this._sharedSecret = this._dh.computeSecret(this._peerPubKey, "hex", "hex"), this.emit("pe1")
                                    }
                                    _onPe2(pubKeyBuffer) {
                                        this._peerPubKey = pubKeyBuffer.toString("hex"), this._sharedSecret = this._dh.computeSecret(this._peerPubKey, "hex", "hex"), this.emit("pe2")
                                    }
                                    _onPe3(hashesXorBuffer) {
                                        const hash3 = sha1.sync(Buffer.from(this._utfToHex("req3") + this._sharedSecret, "hex")),
                                            sKeyHash = xor(Buffer.from(hash3, "hex"), hashesXorBuffer).toString("hex");
                                        this.emit("pe3", sKeyHash)
                                    }
                                    _onPe3Encrypted(vcBuffer, peerProvideBuffer) {
                                        if (!vcBuffer.equals(VC)) return this._debug("Error: verification constant did not match"), void this.destroy();
                                        for (const provideByte of peerProvideBuffer.values()) 0 !== provideByte && this._peerCryptoProvide.push(provideByte);
                                        this._peerCryptoProvide.includes(2) ? this._encryptionMethod = 2 : (this._debug("Error: RC4 encryption method not provided by peer"), this.destroy())
                                    }
                                    _onPe4(peerSelectBuffer) {
                                        this._encryptionMethod = peerSelectBuffer.readUInt8(3), CRYPTO_PROVIDE.includes(this._encryptionMethod) || (this._debug("Error: peer selected invalid crypto method"), this.destroy()), this._cryptoHandshakeDone = !0, this._debug("crypto handshake done"), this.emit("pe4")
                                    }
                                    _onHandshake(infoHashBuffer, peerIdBuffer, extensions) {
                                        const infoHash = infoHashBuffer.toString("hex"),
                                            peerId = peerIdBuffer.toString("hex");
                                        for (const name in this._debug("got handshake i=%s p=%s exts=%o", infoHash, peerId, extensions), this.peerId = peerId, this.peerIdBuffer = peerIdBuffer, this.peerExtensions = extensions, this.extensions.fast && this.peerExtensions.fast && (this._debug("fast extension is enabled"), this.hasFast = !0), this.emit("handshake", infoHash, peerId, extensions), this._ext) this._ext[name].onHandshake(infoHash, peerId, extensions);
                                        extensions.extended && this._handshakeSent && !this._extendedHandshakeSent && this._sendExtendedHandshake()
                                    }
                                    _onChoke() {
                                        if (this.peerChoking = !0, this._debug("got choke"), this.emit("choke"), !this.hasFast)
                                            for (; this.requests.length;) this._callback(this.requests.pop(), new Error("peer is choking"), null)
                                    }
                                    _onUnchoke() {
                                        this.peerChoking = !1, this._debug("got unchoke"), this.emit("unchoke")
                                    }
                                    _onInterested() {
                                        this.peerInterested = !0, this._debug("got interested"), this.emit("interested")
                                    }
                                    _onUninterested() {
                                        this.peerInterested = !1, this._debug("got uninterested"), this.emit("uninterested")
                                    }
                                    _onHave(index) {
                                        this.peerPieces.get(index) || (this._debug("got have %d", index), this.peerPieces.set(index, !0), this.emit("have", index))
                                    }
                                    _onBitField(buffer) {
                                        this.peerPieces = new BitField(buffer), this._debug("got bitfield"), this.emit("bitfield", this.peerPieces)
                                    }
                                    _onRequest(index, offset, length) {
                                        if (this.amChoking && !(this.hasFast && this.allowedFastSet.includes(index))) return void(this.hasFast && this.reject(index, offset, length));
                                        this._debug("got request index=%d offset=%d length=%d", index, offset, length);
                                        const respond = (err, buffer) => request === this._pull(this.peerRequests, index, offset, length) ? err ? (this._debug("error satisfying request index=%d offset=%d length=%d (%s)", index, offset, length, err.message), void(this.hasFast && this.reject(index, offset, length))) : void this.piece(index, offset, buffer) : void 0,
                                            request = new Request(index, offset, length, respond);
                                        this.peerRequests.push(request), this.emit("request", index, offset, length, respond)
                                    }
                                    _onPiece(index, offset, buffer) {
                                        this._debug("got piece index=%d offset=%d", index, offset), this._callback(this._pull(this.requests, index, offset, buffer.length), null, buffer), this.downloaded += buffer.length, this.downloadSpeed(buffer.length), this.emit("download", buffer.length), this.emit("piece", index, offset, buffer)
                                    }
                                    _onCancel(index, offset, length) {
                                        this._debug("got cancel index=%d offset=%d length=%d", index, offset, length), this._pull(this.peerRequests, index, offset, length), this.emit("cancel", index, offset, length)
                                    }
                                    _onPort(port) {
                                        this._debug("got port %d", port), this.emit("port", port)
                                    }
                                    _onSuggest(index) {
                                        return this.hasFast ? void(this._debug("got suggest %d", index), this.emit("suggest", index)) : (this._debug("Error: got suggest whereas fast extension is disabled"), void this.destroy())
                                    }
                                    _onHaveAll() {
                                        return this.hasFast ? void(this._debug("got have-all"), this.peerPieces = new HaveAllBitField, this.emit("have-all")) : (this._debug("Error: got have-all whereas fast extension is disabled"), void this.destroy())
                                    }
                                    _onHaveNone() {
                                        return this.hasFast ? void(this._debug("got have-none"), this.emit("have-none")) : (this._debug("Error: got have-none whereas fast extension is disabled"), void this.destroy())
                                    }
                                    _onReject(index, offset, length) {
                                        return this.hasFast ? void(this._debug("got reject index=%d offset=%d length=%d", index, offset, length), this._callback(this._pull(this.requests, index, offset, length), new Error("request was rejected"), null), this.emit("reject", index, offset, length)) : (this._debug("Error: got reject whereas fast extension is disabled"), void this.destroy())
                                    }
                                    _onAllowedFast(index) {
                                        return this.hasFast ? void(this._debug("got allowed-fast %d", index), !this.peerAllowedFastSet.includes(index) && this.peerAllowedFastSet.push(index), this.peerAllowedFastSet.length > ALLOWED_FAST_SET_MAX_LENGTH && this.peerAllowedFastSet.shift(), this.emit("allowed-fast", index)) : (this._debug("Error: got allowed-fast whereas fast extension is disabled"), void this.destroy())
                                    }
                                    _onExtended(ext, buf) {
                                        if (0 === ext) {
                                            let info;
                                            try {
                                                info = bencode.decode(buf)
                                            } catch (err) {
                                                this._debug("ignoring invalid extended handshake: %s", err.message || err)
                                            }
                                            if (!info) return;
                                            if (this.peerExtendedHandshake = info, "object" == typeof info.m)
                                                for (const name in info.m) this.peerExtendedMapping[name] = +info.m[name].toString();
                                            for (const name in this._ext) this.peerExtendedMapping[name] && this._ext[name].onExtendedHandshake(this.peerExtendedHandshake);
                                            this._debug("got extended handshake"), this.emit("extended", "handshake", this.peerExtendedHandshake)
                                        } else this.extendedMapping[ext] && (ext = this.extendedMapping[ext], this._ext[ext] && this._ext[ext].onMessage(buf)), this._debug("got extended message ext=%s", ext), this.emit("extended", ext, buf)
                                    }
                                    _onTimeout() {
                                        this._debug("request timed out"), this._callback(this.requests.shift(), new Error("request has timed out"), null), this.emit("timeout")
                                    }
                                    _write(data, encoding, cb) {
                                        if (2 === this._encryptionMethod && this._cryptoHandshakeDone && (data = this._decrypt(data)), this._bufferSize += data.length, this._buffer.push(data), 1 < this._buffer.length && (this._buffer = [Buffer.concat(this._buffer, this._bufferSize)]), this._cryptoSyncPattern) {
                                            const index = this._buffer[0].indexOf(this._cryptoSyncPattern);
                                            if (-1 !== index) this._buffer[0] = this._buffer[0].slice(index + this._cryptoSyncPattern.length), this._bufferSize -= index + this._cryptoSyncPattern.length, this._cryptoSyncPattern = null;
                                            else if (this._bufferSize + data.length > this._waitMaxBytes + this._cryptoSyncPattern.length) return this._debug("Error: could not resynchronize"), void this.destroy()
                                        }
                                        for (; this._bufferSize >= this._parserSize && !this._cryptoSyncPattern;)
                                            if (0 === this._parserSize) this._parser(Buffer.from([]));
                                            else {
                                                const buffer = this._buffer[0];
                                                this._bufferSize -= this._parserSize, this._buffer = this._bufferSize ? [buffer.slice(this._parserSize)] : [], this._parser(buffer.slice(0, this._parserSize))
                                            } cb(null)
                                    }
                                    _callback(request, err, buffer) {
                                        request && (this._resetTimeout(!this.peerChoking && !this._finished), request.callback(err, buffer))
                                    }
                                    _resetTimeout(setAgain) {
                                        if (!setAgain || !this._timeoutMs || !this.requests.length) return clearTimeout(this._timeout), this._timeout = null, void(this._timeoutExpiresAt = null);
                                        const timeoutExpiresAt = Date.now() + this._timeoutMs;
                                        if (this._timeout) {
                                            if (timeoutExpiresAt - this._timeoutExpiresAt < .05 * this._timeoutMs) return;
                                            clearTimeout(this._timeout)
                                        }
                                        this._timeoutExpiresAt = timeoutExpiresAt, this._timeout = setTimeout(() => this._onTimeout(), this._timeoutMs), this._timeoutUnref && this._timeout.unref && this._timeout.unref()
                                    }
                                    _parse(size, parser) {
                                        this._parserSize = size, this._parser = parser
                                    }
                                    _parseUntil(pattern, maxBytes) {
                                        this._cryptoSyncPattern = pattern, this._waitMaxBytes = maxBytes
                                    }
                                    _onMessageLength(buffer) {
                                        const length = buffer.readUInt32BE(0);
                                        0 < length ? this._parse(length, this._onMessage) : (this._onKeepAlive(), this._parse(4, this._onMessageLength))
                                    }
                                    _onMessage(buffer) {
                                        switch (this._parse(4, this._onMessageLength), buffer[0]) {
                                            case 0:
                                                return this._onChoke();
                                            case 1:
                                                return this._onUnchoke();
                                            case 2:
                                                return this._onInterested();
                                            case 3:
                                                return this._onUninterested();
                                            case 4:
                                                return this._onHave(buffer.readUInt32BE(1));
                                            case 5:
                                                return this._onBitField(buffer.slice(1));
                                            case 6:
                                                return this._onRequest(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.readUInt32BE(9));
                                            case 7:
                                                return this._onPiece(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.slice(9));
                                            case 8:
                                                return this._onCancel(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.readUInt32BE(9));
                                            case 9:
                                                return this._onPort(buffer.readUInt16BE(1));
                                            case 13:
                                                return this._onSuggest(buffer.readUInt32BE(1));
                                            case 14:
                                                return this._onHaveAll();
                                            case 15:
                                                return this._onHaveNone();
                                            case 16:
                                                return this._onReject(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.readUInt32BE(9));
                                            case 17:
                                                return this._onAllowedFast(buffer.readUInt32BE(1));
                                            case 20:
                                                return this._onExtended(buffer.readUInt8(1), buffer.slice(2));
                                            default:
                                                return this._debug("got unknown message"), this.emit("unknownmessage", buffer);
                                        }
                                    }
                                    _determineHandshakeType() {
                                        this._parse(1, pstrLenBuffer => {
                                            const pstrlen = pstrLenBuffer.readUInt8(0);
                                            19 === pstrlen ? this._parse(pstrlen + 48, this._onHandshakeBuffer) : this._parsePe1(pstrLenBuffer)
                                        })
                                    }
                                    _parsePe1(pubKeyPrefix) {
                                        this._parse(95, pubKeySuffix => {
                                            this._onPe1(Buffer.concat([pubKeyPrefix, pubKeySuffix])), this._parsePe3()
                                        })
                                    }
                                    _parsePe2() {
                                        this._parse(96, pubKey => {
                                            for (this._onPe2(pubKey); !this._setGenerators;);
                                            this._parsePe4()
                                        })
                                    }
                                    _parsePe3() {
                                        const hash1Buffer = Buffer.from(sha1.sync(Buffer.from(this._utfToHex("req1") + this._sharedSecret, "hex")), "hex");
                                        this._parseUntil(hash1Buffer, 512), this._parse(20, buffer => {
                                            for (this._onPe3(buffer); !this._setGenerators;);
                                            this._parsePe3Encrypted()
                                        })
                                    }
                                    _parsePe3Encrypted() {
                                        this._parse(14, buffer => {
                                            const vcBuffer = this._decryptHandshake(buffer.slice(0, 8)),
                                                peerProvideBuffer = this._decryptHandshake(buffer.slice(8, 12)),
                                                padCLen = this._decryptHandshake(buffer.slice(12, 14)).readUInt16BE(0);
                                            this._parse(padCLen, padCBuffer => {
                                                padCBuffer = this._decryptHandshake(padCBuffer), this._parse(2, iaLenBuf => {
                                                    const iaLen = this._decryptHandshake(iaLenBuf).readUInt16BE(0);
                                                    this._parse(iaLen, iaBuffer => {
                                                        iaBuffer = this._decryptHandshake(iaBuffer), this._onPe3Encrypted(vcBuffer, peerProvideBuffer, padCBuffer, iaBuffer);
                                                        const pstrlen = iaLen ? iaBuffer.readUInt8(0) : null,
                                                            protocol = iaLen ? iaBuffer.slice(1, 20) : null;
                                                        19 === pstrlen && "BitTorrent protocol" === protocol.toString() ? this._onHandshakeBuffer(iaBuffer.slice(1)) : this._parseHandshake()
                                                    })
                                                })
                                            })
                                        })
                                    }
                                    _parsePe4() {
                                        const vcBufferEncrypted = this._decryptHandshake(VC);
                                        this._parseUntil(vcBufferEncrypted, 512), this._parse(6, buffer => {
                                            const peerSelectBuffer = this._decryptHandshake(buffer.slice(0, 4)),
                                                padDLen = this._decryptHandshake(buffer.slice(4, 6)).readUInt16BE(0);
                                            this._parse(padDLen, padDBuf => {
                                                this._decryptHandshake(padDBuf), this._onPe4(peerSelectBuffer), this._parseHandshake(null)
                                            })
                                        })
                                    }
                                    _parseHandshake() {
                                        this._parse(1, buffer => {
                                            const pstrlen = buffer.readUInt8(0);
                                            return 19 === pstrlen ? void this._parse(pstrlen + 48, this._onHandshakeBuffer) : (this._debug("Error: wire not speaking BitTorrent protocol (%s)", pstrlen.toString()), void this.end())
                                        })
                                    }
                                    _onHandshakeBuffer(handshake) {
                                        const protocol = handshake.slice(0, 19);
                                        return "BitTorrent protocol" === protocol.toString() ? void(handshake = handshake.slice(19), this._onHandshake(handshake.slice(8, 28), handshake.slice(28, 48), {
                                            dht: !!(1 & handshake[7]),
                                            fast: !!(4 & handshake[7]),
                                            extended: !!(16 & handshake[5])
                                        }), this._parse(4, this._onMessageLength)) : (this._debug("Error: wire not speaking BitTorrent protocol (%s)", protocol.toString()), void this.end())
                                    }
                                    _onFinish() {
                                        for (this._finished = !0, this.push(null); this.read(););
                                        for (clearInterval(this._keepAliveInterval), this._parse(Number.MAX_VALUE, () => {}); this.peerRequests.length;) this.peerRequests.pop();
                                        for (; this.requests.length;) this._callback(this.requests.pop(), new Error("wire was closed"), null)
                                    }
                                    _debug(...args) {
                                        args[0] = `[${this._debugId}] ${args[0]}`, debug(...args)
                                    }
                                    _pull(requests, piece, offset, length) {
                                        for (let i = 0; i < requests.length; i++) {
                                            const req = requests[i];
                                            if (req.piece === piece && req.offset === offset && req.length === length) return arrayRemove(requests, i), req
                                        }
                                        return null
                                    }
                                    _encryptHandshake(buf) {
                                        const crypt = Buffer.from(buf);
                                        if (!this._encryptGenerator) return this._debug("Warning: Encrypting without any generator"), crypt;
                                        for (let i = 0; i < buf.length; i++) {
                                            const keystream = this._encryptGenerator.randomByte();
                                            crypt[i] ^= keystream
                                        }
                                        return crypt
                                    }
                                    _encrypt(buf) {
                                        const crypt = Buffer.from(buf);
                                        if (!this._encryptGenerator || 2 !== this._encryptionMethod) return crypt;
                                        for (let i = 0; i < buf.length; i++) {
                                            const keystream = this._encryptGenerator.randomByte();
                                            crypt[i] ^= keystream
                                        }
                                        return crypt
                                    }
                                    _decryptHandshake(buf) {
                                        const decrypt = Buffer.from(buf);
                                        if (!this._decryptGenerator) return this._debug("Warning: Decrypting without any generator"), decrypt;
                                        for (let i = 0; i < buf.length; i++) {
                                            const keystream = this._decryptGenerator.randomByte();
                                            decrypt[i] ^= keystream
                                        }
                                        return decrypt
                                    }
                                    _decrypt(buf) {
                                        const decrypt = Buffer.from(buf);
                                        if (!this._decryptGenerator || 2 !== this._encryptionMethod) return decrypt;
                                        for (let i = 0; i < buf.length; i++) {
                                            const keystream = this._decryptGenerator.randomByte();
                                            decrypt[i] ^= keystream
                                        }
                                        return decrypt
                                    }
                                    _utfToHex(str) {
                                        return Buffer.from(str, "utf8").toString("hex")
                                    }
                                }
                                module.exports = Wire
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        bencode: 27,
                        bitfield: 31,
                        buffer: 76,
                        crypto: 90,
                        debug: 91,
                        randombytes: 209,
                        rc4: 213,
                        "readable-stream": 228,
                        "simple-sha1": 248,
                        speedometer: 255,
                        "unordered-array-remove": 273
                    }],
                    33: [function (require, module, exports) {
                        (function (process, Buffer) {
                            (function () {
                                const debug = require("debug")("bittorrent-tracker:client"),
                                    EventEmitter = require("events"),
                                    once = require("once"),
                                    parallel = require("run-parallel"),
                                    Peer = require("simple-peer"),
                                    queueMicrotask = require("queue-microtask"),
                                    common = require("./lib/common"),
                                    HTTPTracker = require("./lib/client/http-tracker"),
                                    UDPTracker = require("./lib/client/udp-tracker"),
                                    WebSocketTracker = require("./lib/client/websocket-tracker");
                                class Client extends EventEmitter {
                                    constructor(opts = {}) {
                                        if (super(), !opts.peerId) throw new Error("Option `peerId` is required");
                                        if (!opts.infoHash) throw new Error("Option `infoHash` is required");
                                        if (!opts.announce) throw new Error("Option `announce` is required");
                                        if (!process.browser && !opts.port) throw new Error("Option `port` is required");
                                        this.peerId = "string" == typeof opts.peerId ? opts.peerId : opts.peerId.toString("hex"), this._peerIdBuffer = Buffer.from(this.peerId, "hex"), this._peerIdBinary = this._peerIdBuffer.toString("binary"), this.infoHash = "string" == typeof opts.infoHash ? opts.infoHash.toLowerCase() : opts.infoHash.toString("hex"), this._infoHashBuffer = Buffer.from(this.infoHash, "hex"), this._infoHashBinary = this._infoHashBuffer.toString("binary"), debug("new client %s", this.infoHash), this.destroyed = !1, this._port = opts.port, this._getAnnounceOpts = opts.getAnnounceOpts, this._rtcConfig = opts.rtcConfig, this._userAgent = opts.userAgent, this._proxyOpts = opts.proxyOpts, this._wrtc = "function" == typeof opts.wrtc ? opts.wrtc() : opts.wrtc;
                                        let announce = "string" == typeof opts.announce ? [opts.announce] : null == opts.announce ? [] : opts.announce;
                                        announce = announce.map(announceUrl => (announceUrl = announceUrl.toString(), "/" === announceUrl[announceUrl.length - 1] && (announceUrl = announceUrl.substring(0, announceUrl.length - 1)), announceUrl)), announce = Array.from(new Set(announce));
                                        const webrtcSupport = !1 !== this._wrtc && (!!this._wrtc || Peer.WEBRTC_SUPPORT),
                                            nextTickWarn = err => {
                                                queueMicrotask(() => {
                                                    this.emit("warning", err)
                                                })
                                            };
                                        this._trackers = announce.map(announceUrl => {
                                            let parsedUrl;
                                            try {
                                                parsedUrl = common.parseUrl(announceUrl)
                                            } catch (err) {
                                                return nextTickWarn(new Error(`Invalid tracker URL: ${announceUrl}`)), null
                                            }
                                            const port = parsedUrl.port;
                                            if (0 > port || 65535 < port) return nextTickWarn(new Error(`Invalid tracker port: ${announceUrl}`)), null;
                                            const protocol = parsedUrl.protocol;
                                            return ("http:" === protocol || "https:" === protocol) && "function" == typeof HTTPTracker ? new HTTPTracker(this, announceUrl) : "udp:" === protocol && "function" == typeof UDPTracker ? new UDPTracker(this, announceUrl) : ("ws:" === protocol || "wss:" === protocol) && webrtcSupport ? "ws:" === protocol && "undefined" != typeof window && "https:" === window.location.protocol ? (nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`)), null) : new WebSocketTracker(this, announceUrl) : (nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`)), null)
                                        }).filter(Boolean)
                                    }
                                    start(opts) {
                                        opts = this._defaultAnnounceOpts(opts), opts.event = "started", debug("send `start` %o", opts), this._announce(opts), this._trackers.forEach(tracker => {
                                            tracker.setInterval()
                                        })
                                    }
                                    stop(opts) {
                                        opts = this._defaultAnnounceOpts(opts), opts.event = "stopped", debug("send `stop` %o", opts), this._announce(opts)
                                    }
                                    complete(opts) {
                                        opts || (opts = {}), opts = this._defaultAnnounceOpts(opts), opts.event = "completed", debug("send `complete` %o", opts), this._announce(opts)
                                    }
                                    update(opts) {
                                        opts = this._defaultAnnounceOpts(opts), opts.event && delete opts.event, debug("send `update` %o", opts), this._announce(opts)
                                    }
                                    _announce(opts) {
                                        this._trackers.forEach(tracker => {
                                            tracker.announce(opts)
                                        })
                                    }
                                    scrape(opts) {
                                        debug("send `scrape`"), opts || (opts = {}), this._trackers.forEach(tracker => {
                                            tracker.scrape(opts)
                                        })
                                    }
                                    setInterval(intervalMs) {
                                        debug("setInterval %d", intervalMs), this._trackers.forEach(tracker => {
                                            tracker.setInterval(intervalMs)
                                        })
                                    }
                                    destroy(cb) {
                                        if (!this.destroyed) {
                                            this.destroyed = !0, debug("destroy");
                                            const tasks = this._trackers.map(tracker => cb => {
                                                tracker.destroy(cb)
                                            });
                                            parallel(tasks, cb), this._trackers = [], this._getAnnounceOpts = null
                                        }
                                    }
                                    _defaultAnnounceOpts(opts = {}) {
                                        return null == opts.numwant && (opts.numwant = common.DEFAULT_ANNOUNCE_PEERS), null == opts.uploaded && (opts.uploaded = 0), null == opts.downloaded && (opts.downloaded = 0), this._getAnnounceOpts && (opts = Object.assign({}, opts, this._getAnnounceOpts())), opts
                                    }
                                }
                                Client.scrape = (opts, cb) => {
                                    if (cb = once(cb), !opts.infoHash) throw new Error("Option `infoHash` is required");
                                    if (!opts.announce) throw new Error("Option `announce` is required");
                                    const clientOpts = Object.assign({}, opts, {
                                            infoHash: Array.isArray(opts.infoHash) ? opts.infoHash[0] : opts.infoHash,
                                            peerId: Buffer.from("01234567890123456789"),
                                            port: 6881
                                        }),
                                        client = new Client(clientOpts);
                                    client.once("error", cb), client.once("warning", cb);
                                    let len = Array.isArray(opts.infoHash) ? opts.infoHash.length : 1;
                                    const results = {};
                                    return client.on("scrape", data => {
                                        if (len -= 1, results[data.infoHash] = data, 0 === len) {
                                            client.destroy();
                                            const keys = Object.keys(results);
                                            1 === keys.length ? cb(null, results[keys[0]]) : cb(null, results)
                                        }
                                    }), opts.infoHash = Array.isArray(opts.infoHash) ? opts.infoHash.map(infoHash => Buffer.from(infoHash, "hex")) : Buffer.from(opts.infoHash, "hex"), client.scrape({
                                        infoHash: opts.infoHash
                                    }), client
                                }, module.exports = Client
                            }).call(this)
                        }).call(this, require("_process"), require("buffer").Buffer)
                    }, {
                        "./lib/client/http-tracker": 42,
                        "./lib/client/udp-tracker": 42,
                        "./lib/client/websocket-tracker": 35,
                        "./lib/common": 36,
                        _process: 193,
                        buffer: 76,
                        debug: 91,
                        events: 123,
                        once: 178,
                        "queue-microtask": 206,
                        "run-parallel": 233,
                        "simple-peer": 247
                    }],
                    34: [function (require, module, exports) {
                        const EventEmitter = require("events");
                        class Tracker extends EventEmitter {
                            constructor(client, announceUrl) {
                                super(), this.client = client, this.announceUrl = announceUrl, this.interval = null, this.destroyed = !1
                            }
                            setInterval(intervalMs) {
                                null == intervalMs && (intervalMs = this.DEFAULT_ANNOUNCE_INTERVAL), clearInterval(this.interval), intervalMs && (this.interval = setInterval(() => {
                                    this.announce(this.client._defaultAnnounceOpts())
                                }, intervalMs), this.interval.unref && this.interval.unref())
                            }
                        }
                        module.exports = Tracker
                    }, {
                        events: 123
                    }],
                    35: [function (require, module, exports) {
                        function noop() {}
                        const clone = require("clone"),
                            debug = require("debug")("bittorrent-tracker:websocket-tracker"),
                            Peer = require("simple-peer"),
                            randombytes = require("randombytes"),
                            Socket = require("simple-websocket"),
                            Socks = require("socks"),
                            common = require("../common"),
                            Tracker = require("./tracker"),
                            socketPool = {},
                            RECONNECT_MINIMUM = 10000,
                            RECONNECT_MAXIMUM = 3600000,
                            RECONNECT_VARIANCE = 300000,
                            OFFER_TIMEOUT = 50000;
                        class WebSocketTracker extends Tracker {
                            constructor(client, announceUrl) {
                                super(client, announceUrl), debug("new websocket tracker %s", announceUrl), this.peers = {}, this.socket = null, this.reconnecting = !1, this.retries = 0, this.reconnectTimer = null, this.expectingResponse = !1, this._openSocket()
                            }
                            announce(opts) {
                                if (this.destroyed || this.reconnecting) return;
                                if (!this.socket.connected) return void this.socket.once("connect", () => {
                                    this.announce(opts)
                                });
                                const params = Object.assign({}, opts, {
                                    action: "announce",
                                    info_hash: this.client._infoHashBinary,
                                    peer_id: this.client._peerIdBinary
                                });
                                if (this._trackerId && (params.trackerid = this._trackerId), "stopped" === opts.event || "completed" === opts.event) this._send(params);
                                else {
                                    const numwant = _Mathmin(opts.numwant, 5);
                                    this._generateOffers(numwant, offers => {
                                        params.numwant = numwant, params.offers = offers, this._send(params)
                                    })
                                }
                            }
                            scrape(opts) {
                                if (this.destroyed || this.reconnecting) return;
                                if (!this.socket.connected) return void this.socket.once("connect", () => {
                                    this.scrape(opts)
                                });
                                const infoHashes = Array.isArray(opts.infoHash) && 0 < opts.infoHash.length ? opts.infoHash.map(infoHash => infoHash.toString("binary")) : opts.infoHash && opts.infoHash.toString("binary") || this.client._infoHashBinary,
                                    params = {
                                        action: "scrape",
                                        info_hash: infoHashes
                                    };
                                this._send(params)
                            }
                            destroy(cb = noop) {
                                function destroyCleanup() {
                                    timeout && (clearTimeout(timeout), timeout = null), socket.removeListener("data", destroyCleanup), socket.destroy(), socket = null
                                }
                                if (this.destroyed) return cb(null);
                                for (const peerId in this.destroyed = !0, clearInterval(this.interval), clearTimeout(this.reconnectTimer), this.peers) {
                                    const peer = this.peers[peerId];
                                    clearTimeout(peer.trackerTimeout), peer.destroy()
                                }
                                if (this.peers = null, this.socket && (this.socket.removeListener("connect", this._onSocketConnectBound), this.socket.removeListener("data", this._onSocketDataBound), this.socket.removeListener("close", this._onSocketCloseBound), this.socket.removeListener("error", this._onSocketErrorBound), this.socket = null), this._onSocketConnectBound = null, this._onSocketErrorBound = null, this._onSocketDataBound = null, this._onSocketCloseBound = null, socketPool[this.announceUrl] && (socketPool[this.announceUrl].consumers -= 1), 0 < socketPool[this.announceUrl].consumers) return cb();
                                let socket = socketPool[this.announceUrl];
                                delete socketPool[this.announceUrl], socket.on("error", noop), socket.once("close", cb);
                                let timeout;
                                return this.expectingResponse ? void(timeout = setTimeout(destroyCleanup, common.DESTROY_TIMEOUT), socket.once("data", destroyCleanup)) : destroyCleanup()
                            }
                            _openSocket() {
                                if (this.destroyed = !1, this.peers || (this.peers = {}), this._onSocketConnectBound = () => {
                                        this._onSocketConnect()
                                    }, this._onSocketErrorBound = err => {
                                        this._onSocketError(err)
                                    }, this._onSocketDataBound = data => {
                                        this._onSocketData(data)
                                    }, this._onSocketCloseBound = () => {
                                        this._onSocketClose()
                                    }, this.socket = socketPool[this.announceUrl], this.socket) socketPool[this.announceUrl].consumers += 1, this.socket.connected && this._onSocketConnectBound();
                                else {
                                    const parsedUrl = new URL(this.announceUrl);
                                    let agent;
                                    this.client._proxyOpts && (agent = "wss:" === parsedUrl.protocol ? this.client._proxyOpts.httpsAgent : this.client._proxyOpts.httpAgent, !agent && this.client._proxyOpts.socksProxy && (agent = new Socks.Agent(clone(this.client._proxyOpts.socksProxy), "wss:" === parsedUrl.protocol))), this.socket = socketPool[this.announceUrl] = new Socket({
                                        url: this.announceUrl,
                                        agent
                                    }), this.socket.consumers = 1, this.socket.once("connect", this._onSocketConnectBound)
                                }
                                this.socket.on("data", this._onSocketDataBound), this.socket.once("close", this._onSocketCloseBound), this.socket.once("error", this._onSocketErrorBound)
                            }
                            _onSocketConnect() {
                                this.destroyed || this.reconnecting && (this.reconnecting = !1, this.retries = 0, this.announce(this.client._defaultAnnounceOpts()))
                            }
                            _onSocketData(data) {
                                if (!this.destroyed) {
                                    this.expectingResponse = !1;
                                    try {
                                        data = JSON.parse(data)
                                    } catch (err) {
                                        return void this.client.emit("warning", new Error("Invalid tracker response"))
                                    }
                                    "announce" === data.action ? this._onAnnounceResponse(data) : "scrape" === data.action ? this._onScrapeResponse(data) : this._onSocketError(new Error(`invalid action in WS response: ${data.action}`))
                                }
                            }
                            _onAnnounceResponse(data) {
                                if (data.info_hash !== this.client._infoHashBinary) return void debug("ignoring websocket data from %s for %s (looking for %s: reused socket)", this.announceUrl, common.binaryToHex(data.info_hash), this.client.infoHash);
                                if (data.peer_id && data.peer_id === this.client._peerIdBinary) return;
                                debug("received %s from %s for %s", JSON.stringify(data), this.announceUrl, this.client.infoHash);
                                const failure = data["failure reason"];
                                if (failure) return this.client.emit("warning", new Error(failure));
                                const warning = data["warning message"];
                                warning && this.client.emit("warning", new Error(warning));
                                const interval = data.interval || data["min interval"];
                                interval && this.setInterval(1e3 * interval);
                                const trackerId = data["tracker id"];
                                if (trackerId && (this._trackerId = trackerId), null != data.complete) {
                                    const response = Object.assign({}, data, {
                                        announce: this.announceUrl,
                                        infoHash: common.binaryToHex(data.info_hash)
                                    });
                                    this.client.emit("update", response)
                                }
                                let peer;
                                if (data.offer && data.peer_id && (debug("creating peer (from remote offer)"), peer = this._createPeer(), peer.id = common.binaryToHex(data.peer_id), peer.once("signal", answer => {
                                        const params = {
                                            action: "announce",
                                            info_hash: this.client._infoHashBinary,
                                            peer_id: this.client._peerIdBinary,
                                            to_peer_id: data.peer_id,
                                            answer,
                                            offer_id: data.offer_id
                                        };
                                        this._trackerId && (params.trackerid = this._trackerId), this._send(params)
                                    }), this.client.emit("peer", peer), peer.signal(data.offer)), data.answer && data.peer_id) {
                                    const offerId = common.binaryToHex(data.offer_id);
                                    peer = this.peers[offerId], peer ? (peer.id = common.binaryToHex(data.peer_id), this.client.emit("peer", peer), peer.signal(data.answer), clearTimeout(peer.trackerTimeout), peer.trackerTimeout = null, delete this.peers[offerId]) : debug(`got unexpected answer: ${JSON.stringify(data.answer)}`)
                                }
                            }
                            _onScrapeResponse(data) {
                                data = data.files || {};
                                const keys = Object.keys(data);
                                return 0 === keys.length ? void this.client.emit("warning", new Error("invalid scrape response")) : void keys.forEach(infoHash => {
                                    const response = Object.assign(data[infoHash], {
                                        announce: this.announceUrl,
                                        infoHash: common.binaryToHex(infoHash)
                                    });
                                    this.client.emit("scrape", response)
                                })
                            }
                            _onSocketClose() {
                                this.destroyed || (this.destroy(), this._startReconnectTimer())
                            }
                            _onSocketError(err) {
                                this.destroyed || (this.destroy(), this.client.emit("warning", err), this._startReconnectTimer())
                            }
                            _startReconnectTimer() {
                                const ms = _Mathfloor(Math.random() * RECONNECT_VARIANCE) + _Mathmin(_Mathpow(2, this.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM);
                                this.reconnecting = !0, clearTimeout(this.reconnectTimer), this.reconnectTimer = setTimeout(() => {
                                    this.retries++, this._openSocket()
                                }, ms), this.reconnectTimer.unref && this.reconnectTimer.unref(), debug("reconnecting socket in %s ms", ms)
                            }
                            _send(params) {
                                if (!this.destroyed) {
                                    this.expectingResponse = !0;
                                    const message = JSON.stringify(params);
                                    debug("send %s", message), this.socket.send(message)
                                }
                            }
                            _generateOffers(numwant, cb) {
                                function generateOffer() {
                                    const offerId = randombytes(20).toString("hex");
                                    debug("creating peer (from _generateOffers)");
                                    const peer = self.peers[offerId] = self._createPeer({
                                        initiator: !0
                                    });
                                    peer.once("signal", offer => {
                                        offers.push({
                                            offer,
                                            offer_id: common.hexToBinary(offerId)
                                        }), checkDone()
                                    }), peer.trackerTimeout = setTimeout(() => {
                                        debug("tracker timeout: destroying peer"), peer.trackerTimeout = null, delete self.peers[offerId], peer.destroy()
                                    }, OFFER_TIMEOUT), peer.trackerTimeout.unref && peer.trackerTimeout.unref()
                                }

                                function checkDone() {
                                    offers.length === numwant && (debug("generated %s offers", numwant), cb(offers))
                                }
                                const self = this,
                                    offers = [];
                                debug("generating %s offers", numwant);
                                for (let i = 0; i < numwant; ++i) generateOffer();
                                checkDone()
                            }
                            _createPeer(opts) {
                                function onError(err) {
                                    self.client.emit("warning", new Error(`Connection error: ${err.message}`)), peer.destroy()
                                }

                                function onConnect() {
                                    peer.removeListener("error", onError), peer.removeListener("connect", onConnect)
                                }
                                const self = this;
                                opts = Object.assign({
                                    trickle: !1,
                                    config: self.client._rtcConfig,
                                    wrtc: self.client._wrtc
                                }, opts);
                                const peer = new Peer(opts);
                                return peer.once("error", onError), peer.once("connect", onConnect), peer
                            }
                        }
                        WebSocketTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30000, WebSocketTracker._socketPool = socketPool, module.exports = WebSocketTracker
                    }, {
                        "../common": 36,
                        "./tracker": 34,
                        clone: 81,
                        debug: 91,
                        randombytes: 209,
                        "simple-peer": 247,
                        "simple-websocket": 250,
                        socks: 42
                    }],
                    36: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                exports.DEFAULT_ANNOUNCE_PEERS = 50, exports.MAX_ANNOUNCE_PEERS = 82, exports.binaryToHex = str => ("string" != typeof str && (str += ""), Buffer.from(str, "binary").toString("hex")), exports.hexToBinary = str => ("string" != typeof str && (str += ""), Buffer.from(str, "hex").toString("binary")), exports.parseUrl = str => {
                                    const url = new URL(str.replace(/^udp:/, "http:"));
                                    return str.match(/^udp:/) && Object.defineProperties(url, {
                                        href: {
                                            value: url.href.replace(/^http/, "udp")
                                        },
                                        protocol: {
                                            value: url.protocol.replace(/^http/, "udp")
                                        },
                                        origin: {
                                            value: url.origin.replace(/^http/, "udp")
                                        }
                                    }), url
                                };
                                const config = require("./common-node");
                                Object.assign(exports, config)
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        "./common-node": 42,
                        buffer: 76
                    }],
                    37: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                /*! blob-to-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
                                module.exports = function blobToBuffer(blob, cb) {
                                    function onLoadEnd(e) {
                                        reader.removeEventListener("loadend", onLoadEnd, !1), e.error ? cb(e.error) : cb(null, Buffer.from(reader.result))
                                    }
                                    if ("undefined" == typeof Blob || !(blob instanceof Blob)) throw new Error("first argument must be a Blob");
                                    if ("function" != typeof cb) throw new Error("second argument must be a function");
                                    const reader = new FileReader;
                                    reader.addEventListener("loadend", onLoadEnd, !1), reader.readAsArrayBuffer(blob)
                                }
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76
                    }],
                    38: [function (require, module, exports) {
                        function concat(chunks, size) {
                            if ("string" == typeof chunks[0]) return chunks.join("");
                            if ("number" == typeof chunks[0]) return new Uint8Array(chunks);
                            const b = new Uint8Array(size);
                            let offset = 0;
                            for (let i = 0, l = chunks.length; i < l; i++) {
                                const chunk = chunks[i];
                                b.set(chunk, offset), offset += chunk.byteLength || chunk.length
                            }
                            return b
                        }
                        module.exports = async function* (iterator, size = 512, opts = {}) {
                            "object" == typeof size && (opts = size, size = opts.size);
                            let {
                                nopad,
                                zeroPadding = !0
                            } = opts;
                            nopad && (zeroPadding = !1);
                            let buffered = [],
                                bufferedBytes = 0;
                            for await (const value of iterator) if (bufferedBytes += value.byteLength || value.length || 1, buffered.push(value), bufferedBytes >= size) {
                                const b = concat(buffered, bufferedBytes);
                                let offset = 0;
                                for (; bufferedBytes >= size;) yield b.slice(offset, offset + size), bufferedBytes -= size, offset += size;
                                buffered = [b.slice(offset, b.length)]
                            }
                            bufferedBytes && (yield concat(buffered, zeroPadding ? size : bufferedBytes))
                        }
                    }, {}],
                    39: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                const {
                                    Transform
                                } = require("readable-stream");
                                class Block extends Transform {
                                    constructor(size, opts = {}) {
                                        super(opts), "object" == typeof size && (opts = size, size = opts.size), this.size = size || 512;
                                        const {
                                            nopad,
                                            zeroPadding = !0
                                        } = opts;
                                        this._zeroPadding = !nopad && !!zeroPadding, this._buffered = [], this._bufferedBytes = 0
                                    }
                                    _transform(buf, enc, next) {
                                        for (this._bufferedBytes += buf.length, this._buffered.push(buf); this._bufferedBytes >= this.size;) {
                                            this._bufferedBytes -= this.size;
                                            const blockBufs = [];
                                            for (let blockBufsBytes = 0; blockBufsBytes < this.size;) {
                                                const b = this._buffered.shift();
                                                if (blockBufsBytes + b.length <= this.size) blockBufs.push(b), blockBufsBytes += b.length;
                                                else {
                                                    const neededSize = this.size - blockBufsBytes;
                                                    blockBufs.push(b.slice(0, neededSize)), blockBufsBytes += neededSize, this._buffered.unshift(b.slice(neededSize))
                                                }
                                            }
                                            this.push(Buffer.concat(blockBufs, this.size))
                                        }
                                        next()
                                    }
                                    _flush() {
                                        if (this._bufferedBytes && this._zeroPadding) {
                                            const zeroes = Buffer.alloc(this.size - this._bufferedBytes);
                                            this._buffered.push(zeroes), this.push(Buffer.concat(this._buffered)), this._buffered = null
                                        } else this._bufferedBytes && (this.push(Buffer.concat(this._buffered)), this._buffered = null);
                                        this.push(null)
                                    }
                                }
                                module.exports = Block
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76,
                        "readable-stream": 228
                    }],
                    40: [function (require, module, exports) {
                        (function (module, exports) {
                            "use strict";

                            function assert(val, msg) {
                                if (!val) throw new Error(msg || "Assertion failed")
                            }

                            function inherits(ctor, superCtor) {
                                ctor.super_ = superCtor;
                                var TempCtor = function () {};
                                TempCtor.prototype = superCtor.prototype, ctor.prototype = new TempCtor, ctor.prototype.constructor = ctor
                            }

                            function BN(number, base, endian) {
                                return BN.isBN(number) ? number : void(this.negative = 0, this.words = null, this.length = 0, this.red = null, null !== number && (("le" === base || "be" === base) && (endian = base, base = 10), this._init(number || 0, base || 10, endian || "be")))
                            }

                            function parseHex4Bits(string, index) {
                                var c = string.charCodeAt(index);
                                return 48 <= c && 57 >= c ? c - 48 : 65 <= c && 70 >= c ? c - 55 : 97 <= c && 102 >= c ? c - 87 : void assert(!1, "Invalid character in " + string)
                            }

                            function parseHexByte(string, lowerBound, index) {
                                var r = parseHex4Bits(string, index);
                                return index - 1 >= lowerBound && (r |= parseHex4Bits(string, index - 1) << 4), r
                            }

                            function parseBase(str, start, end, mul) {
                                for (var r = 0, b = 0, len = _Mathmin(str.length, end), i = start, c; i < len; i++) c = str.charCodeAt(i) - 48, r *= mul, b = 49 <= c ? c - 49 + 10 : 17 <= c ? c - 17 + 10 : c, assert(0 <= c && b < mul, "Invalid character"), r += b;
                                return r
                            }

                            function move(dest, src) {
                                dest.words = src.words, dest.length = src.length, dest.negative = src.negative, dest.red = src.red
                            }

                            function inspect() {
                                return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">"
                            }

                            function toBitArray(num) {
                                for (var w = Array(num.bitLength()), bit = 0; bit < w.length; bit++) {
                                    var off = 0 | bit / 26,
                                        wbit = bit % 26;
                                    w[bit] = 1 & num.words[off] >>> wbit
                                }
                                return w
                            }

                            function smallMulTo(self, num, out) {
                                out.negative = num.negative ^ self.negative;
                                var len = 0 | self.length + num.length;
                                out.length = len, len = 0 | len - 1;
                                var a = 0 | self.words[0],
                                    b = 0 | num.words[0],
                                    r = a * b,
                                    lo = 67108863 & r,
                                    carry = 0 | r / 67108864;
                                out.words[0] = lo;
                                for (var k = 1; k < len; k++) {
                                    for (var ncarry = carry >>> 26, rword = 67108863 & carry, maxJ = _Mathmin(k, num.length - 1), j = _Mathmax(0, k - self.length + 1), i; j <= maxJ; j++) i = 0 | k - j, a = 0 | self.words[i], b = 0 | num.words[j], r = a * b + rword, ncarry += 0 | r / 67108864, rword = 67108863 & r;
                                    out.words[k] = 0 | rword, carry = 0 | ncarry
                                }
                                return 0 === carry ? out.length-- : out.words[k] = 0 | carry, out._strip()
                            }

                            function bigMulTo(self, num, out) {
                                out.negative = num.negative ^ self.negative, out.length = self.length + num.length;
                                for (var carry = 0, hncarry = 0, k = 0, ncarry; k < out.length - 1; k++) {
                                    ncarry = hncarry, hncarry = 0;
                                    for (var rword = 67108863 & carry, maxJ = _Mathmin(k, num.length - 1), j = _Mathmax(0, k - self.length + 1); j <= maxJ; j++) {
                                        var i = k - j,
                                            a = 0 | self.words[i],
                                            b = 0 | num.words[j],
                                            r = a * b,
                                            lo = 67108863 & r;
                                        ncarry = 0 | ncarry + (0 | r / 67108864), lo = 0 | lo + rword, rword = 67108863 & lo, ncarry = 0 | ncarry + (lo >>> 26), hncarry += ncarry >>> 26, ncarry &= 67108863
                                    }
                                    out.words[k] = rword, carry = ncarry, ncarry = hncarry
                                }
                                return 0 === carry ? out.length-- : out.words[k] = carry, out._strip()
                            }

                            function jumboMulTo(self, num, out) {
                                return bigMulTo(self, num, out)
                            }

                            function FFTM(x, y) {
                                this.x = x, this.y = y
                            }

                            function MPrime(name, p) {
                                this.name = name, this.p = new BN(p, 16), this.n = this.p.bitLength(), this.k = new BN(1).iushln(this.n).isub(this.p), this.tmp = this._tmp()
                            }

                            function K256() {
                                MPrime.call(this, "k256", "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f")
                            }

                            function P224() {
                                MPrime.call(this, "p224", "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001")
                            }

                            function P192() {
                                MPrime.call(this, "p192", "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff")
                            }

                            function P25519() {
                                MPrime.call(this, "25519", "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed")
                            }

                            function Red(m) {
                                if ("string" == typeof m) {
                                    var prime = BN._prime(m);
                                    this.m = prime.p, this.prime = prime
                                } else assert(m.gtn(1), "modulus must be greater than 1"), this.m = m, this.prime = null
                            }

                            function Mont(m) {
                                Red.call(this, m), this.shift = this.m.bitLength(), 0 != this.shift % 26 && (this.shift += 26 - this.shift % 26), this.r = new BN(1).iushln(this.shift), this.r2 = this.imod(this.r.sqr()), this.rinv = this.r._invmp(this.m), this.minv = this.rinv.mul(this.r).isubn(1).div(this.m), this.minv = this.minv.umod(this.r), this.minv = this.r.sub(this.minv)
                            }
                            "object" == typeof module ? module.exports = BN : exports.BN = BN, BN.BN = BN, BN.wordSize = 26;
                            var Buffer;
                            try {
                                Buffer = "undefined" != typeof window && "undefined" != typeof window.Buffer ? window.Buffer : require("buffer").Buffer
                            } catch (e) {}
                            if (BN.isBN = function isBN(num) {
                                    return !!(num instanceof BN) || null !== num && "object" == typeof num && num.constructor.wordSize === BN.wordSize && Array.isArray(num.words)
                                }, BN.max = function max(left, right) {
                                    return 0 < left.cmp(right) ? left : right
                                }, BN.min = function min(left, right) {
                                    return 0 > left.cmp(right) ? left : right
                                }, BN.prototype._init = function init(number, base, endian) {
                                    if ("number" == typeof number) return this._initNumber(number, base, endian);
                                    if ("object" == typeof number) return this._initArray(number, base, endian);
                                    "hex" === base && (base = 16), assert(base === (0 | base) && 2 <= base && 36 >= base), number = number.toString().replace(/\s+/g, "");
                                    var start = 0;
                                    "-" === number[0] && (start++, this.negative = 1), start < number.length && (16 === base ? this._parseHex(number, start, endian) : (this._parseBase(number, base, start), "le" === endian && this._initArray(this.toArray(), base, endian)))
                                }, BN.prototype._initNumber = function _initNumber(number, base, endian) {
                                    0 > number && (this.negative = 1, number = -number), 67108864 > number ? (this.words = [67108863 & number], this.length = 1) : 4503599627370496 > number ? (this.words = [67108863 & number, 67108863 & number / 67108864], this.length = 2) : (assert(9007199254740992 > number), this.words = [67108863 & number, 67108863 & number / 67108864, 1], this.length = 3), "le" !== endian || this._initArray(this.toArray(), base, endian)
                                }, BN.prototype._initArray = function _initArray(number, base, endian) {
                                    if (assert("number" == typeof number.length), 0 >= number.length) return this.words = [0], this.length = 1, this;
                                    this.length = _Mathceil(number.length / 3), this.words = Array(this.length);
                                    for (var i = 0; i < this.length; i++) this.words[i] = 0;
                                    var off = 0,
                                        j, w;
                                    if ("be" === endian)
                                        for (i = number.length - 1, j = 0; 0 <= i; i -= 3) w = number[i] | number[i - 1] << 8 | number[i - 2] << 16, this.words[j] |= 67108863 & w << off, this.words[j + 1] = 67108863 & w >>> 26 - off, off += 24, 26 <= off && (off -= 26, j++);
                                    else if ("le" === endian)
                                        for (i = 0, j = 0; i < number.length; i += 3) w = number[i] | number[i + 1] << 8 | number[i + 2] << 16, this.words[j] |= 67108863 & w << off, this.words[j + 1] = 67108863 & w >>> 26 - off, off += 24, 26 <= off && (off -= 26, j++);
                                    return this._strip()
                                }, BN.prototype._parseHex = function _parseHex(number, start, endian) {
                                    this.length = _Mathceil((number.length - start) / 6), this.words = Array(this.length);
                                    for (var i = 0; i < this.length; i++) this.words[i] = 0;
                                    var off = 0,
                                        j = 0,
                                        w;
                                    if ("be" === endian)
                                        for (i = number.length - 1; i >= start; i -= 2) w = parseHexByte(number, start, i) << off, this.words[j] |= 67108863 & w, 18 <= off ? (off -= 18, j += 1, this.words[j] |= w >>> 26) : off += 8;
                                    else {
                                        var parseLength = number.length - start;
                                        for (i = 0 == parseLength % 2 ? start + 1 : start; i < number.length; i += 2) w = parseHexByte(number, start, i) << off, this.words[j] |= 67108863 & w, 18 <= off ? (off -= 18, j += 1, this.words[j] |= w >>> 26) : off += 8
                                    }
                                    this._strip()
                                }, BN.prototype._parseBase = function _parseBase(number, base, start) {
                                    this.words = [0], this.length = 1;
                                    for (var limbLen = 0, limbPow = 1; 67108863 >= limbPow; limbPow *= base) limbLen++;
                                    limbLen--, limbPow = 0 | limbPow / base;
                                    for (var total = number.length - start, mod = total % limbLen, end = _Mathmin(total, total - mod) + start, word = 0, i = start; i < end; i += limbLen) word = parseBase(number, i, i + limbLen, base), this.imuln(limbPow), 67108864 > this.words[0] + word ? this.words[0] += word : this._iaddn(word);
                                    if (0 !== mod) {
                                        var pow = 1;
                                        for (word = parseBase(number, i, number.length, base), i = 0; i < mod; i++) pow *= base;
                                        this.imuln(pow), 67108864 > this.words[0] + word ? this.words[0] += word : this._iaddn(word)
                                    }
                                    this._strip()
                                }, BN.prototype.copy = function copy(dest) {
                                    dest.words = Array(this.length);
                                    for (var i = 0; i < this.length; i++) dest.words[i] = this.words[i];
                                    dest.length = this.length, dest.negative = this.negative, dest.red = this.red
                                }, BN.prototype._move = function _move(dest) {
                                    move(dest, this)
                                }, BN.prototype.clone = function clone() {
                                    var r = new BN(null);
                                    return this.copy(r), r
                                }, BN.prototype._expand = function _expand(size) {
                                    for (; this.length < size;) this.words[this.length++] = 0;
                                    return this
                                }, BN.prototype._strip = function strip() {
                                    for (; 1 < this.length && 0 === this.words[this.length - 1];) this.length--;
                                    return this._normSign()
                                }, BN.prototype._normSign = function _normSign() {
                                    return 1 === this.length && 0 === this.words[0] && (this.negative = 0), this
                                }, "undefined" != typeof Symbol && "function" == typeof Symbol.for) try {
                                BN.prototype[Symbol.for("nodejs.util.inspect.custom")] = inspect
                            } catch (e) {
                                BN.prototype.inspect = inspect
                            } else BN.prototype.inspect = inspect;
                            var zeros = ["", "0", "00", "000", "0000", "00000", "000000", "0000000", "00000000", "000000000", "0000000000", "00000000000", "000000000000", "0000000000000", "00000000000000", "000000000000000", "0000000000000000", "00000000000000000", "000000000000000000", "0000000000000000000", "00000000000000000000", "000000000000000000000", "0000000000000000000000", "00000000000000000000000", "000000000000000000000000", "0000000000000000000000000"],
                                groupSizes = [0, 0, 25, 16, 12, 11, 10, 9, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
                                groupBases = [0, 0, 33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216, 43046721, 1e7, 19487171, 35831808, 62748517, 7529536, 11390625, 16777216, 24137569, 34012224, 47045881, 64e6, 4084101, 5153632, 6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149, 243e5, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176];
                            BN.prototype.toString = function toString(base, padding) {
                                base = base || 10, padding = 0 | padding || 1;
                                var out;
                                if (16 === base || "hex" === base) {
                                    out = "";
                                    for (var off = 0, carry = 0, i = 0; i < this.length; i++) {
                                        var w = this.words[i],
                                            word = (16777215 & (w << off | carry)).toString(16);
                                        carry = 16777215 & w >>> 24 - off, off += 2, 26 <= off && (off -= 26, i--), out = 0 !== carry || i !== this.length - 1 ? zeros[6 - word.length] + word + out : word + out
                                    }
                                    for (0 !== carry && (out = carry.toString(16) + out); 0 != out.length % padding;) out = "0" + out;
                                    return 0 !== this.negative && (out = "-" + out), out
                                }
                                if (base === (0 | base) && 2 <= base && 36 >= base) {
                                    var groupSize = groupSizes[base],
                                        groupBase = groupBases[base];
                                    out = "";
                                    var c = this.clone();
                                    for (c.negative = 0; !c.isZero();) {
                                        var r = c.modrn(groupBase).toString(base);
                                        c = c.idivn(groupBase), out = c.isZero() ? r + out : zeros[groupSize - r.length] + r + out
                                    }
                                    for (this.isZero() && (out = "0" + out); 0 != out.length % padding;) out = "0" + out;
                                    return 0 !== this.negative && (out = "-" + out), out
                                }
                                assert(!1, "Base should be between 2 and 36")
                            }, BN.prototype.toNumber = function toNumber() {
                                var ret = this.words[0];
                                return 2 === this.length ? ret += 67108864 * this.words[1] : 3 === this.length && 1 === this.words[2] ? ret += 4503599627370496 + 67108864 * this.words[1] : 2 < this.length && assert(!1, "Number can only safely store up to 53 bits"), 0 === this.negative ? ret : -ret
                            }, BN.prototype.toJSON = function toJSON() {
                                return this.toString(16, 2)
                            }, Buffer && (BN.prototype.toBuffer = function toBuffer(endian, length) {
                                return this.toArrayLike(Buffer, endian, length)
                            }), BN.prototype.toArray = function toArray(endian, length) {
                                return this.toArrayLike(Array, endian, length)
                            };
                            var allocate = function allocate(ArrayType, size) {
                                return ArrayType.allocUnsafe ? ArrayType.allocUnsafe(size) : new ArrayType(size)
                            };
                            BN.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
                                this._strip();
                                var byteLength = this.byteLength(),
                                    reqLength = length || _Mathmax(1, byteLength);
                                assert(byteLength <= reqLength, "byte array longer than desired length"), assert(0 < reqLength, "Requested array length <= 0");
                                var res = allocate(ArrayType, reqLength),
                                    postfix = "le" === endian ? "LE" : "BE";
                                return this["_toArrayLike" + postfix](res, byteLength), res
                            }, BN.prototype._toArrayLikeLE = function _toArrayLikeLE(res, byteLength) {
                                for (var position = 0, carry = 0, i = 0, shift = 0, word; i < this.length; i++) word = this.words[i] << shift | carry, res[position++] = 255 & word, position < res.length && (res[position++] = 255 & word >> 8), position < res.length && (res[position++] = 255 & word >> 16), 6 == shift ? (position < res.length && (res[position++] = 255 & word >> 24), carry = 0, shift = 0) : (carry = word >>> 24, shift += 2);
                                if (position < res.length)
                                    for (res[position++] = carry; position < res.length;) res[position++] = 0
                            }, BN.prototype._toArrayLikeBE = function _toArrayLikeBE(res, byteLength) {
                                for (var position = res.length - 1, carry = 0, i = 0, shift = 0, word; i < this.length; i++) word = this.words[i] << shift | carry, res[position--] = 255 & word, 0 <= position && (res[position--] = 255 & word >> 8), 0 <= position && (res[position--] = 255 & word >> 16), 6 == shift ? (0 <= position && (res[position--] = 255 & word >> 24), carry = 0, shift = 0) : (carry = word >>> 24, shift += 2);
                                if (0 <= position)
                                    for (res[position--] = carry; 0 <= position;) res[position--] = 0
                            }, BN.prototype._countBits = _Mathclz ? function _countBits(w) {
                                return 32 - _Mathclz(w)
                            } : function _countBits(w) {
                                var t = w,
                                    r = 0;
                                return 4096 <= t && (r += 13, t >>>= 13), 64 <= t && (r += 7, t >>>= 7), 8 <= t && (r += 4, t >>>= 4), 2 <= t && (r += 2, t >>>= 2), r + t
                            }, BN.prototype._zeroBits = function _zeroBits(w) {
                                if (0 === w) return 26;
                                var t = w,
                                    r = 0;
                                return 0 == (8191 & t) && (r += 13, t >>>= 13), 0 == (127 & t) && (r += 7, t >>>= 7), 0 == (15 & t) && (r += 4, t >>>= 4), 0 == (3 & t) && (r += 2, t >>>= 2), 0 == (1 & t) && r++, r
                            }, BN.prototype.bitLength = function bitLength() {
                                var w = this.words[this.length - 1],
                                    hi = this._countBits(w);
                                return 26 * (this.length - 1) + hi
                            }, BN.prototype.zeroBits = function zeroBits() {
                                if (this.isZero()) return 0;
                                for (var r = 0, i = 0, b; i < this.length && (b = this._zeroBits(this.words[i]), r += b, 26 === b); i++);
                                return r
                            }, BN.prototype.byteLength = function byteLength() {
                                return _Mathceil(this.bitLength() / 8)
                            }, BN.prototype.toTwos = function toTwos(width) {
                                return 0 === this.negative ? this.clone() : this.abs().inotn(width).iaddn(1)
                            }, BN.prototype.fromTwos = function fromTwos(width) {
                                return this.testn(width - 1) ? this.notn(width).iaddn(1).ineg() : this.clone()
                            }, BN.prototype.isNeg = function isNeg() {
                                return 0 !== this.negative
                            }, BN.prototype.neg = function neg() {
                                return this.clone().ineg()
                            }, BN.prototype.ineg = function ineg() {
                                return this.isZero() || (this.negative ^= 1), this
                            }, BN.prototype.iuor = function iuor(num) {
                                for (; this.length < num.length;) this.words[this.length++] = 0;
                                for (var i = 0; i < num.length; i++) this.words[i] |= num.words[i];
                                return this._strip()
                            }, BN.prototype.ior = function ior(num) {
                                return assert(0 == (this.negative | num.negative)), this.iuor(num)
                            }, BN.prototype.or = function or(num) {
                                return this.length > num.length ? this.clone().ior(num) : num.clone().ior(this)
                            }, BN.prototype.uor = function uor(num) {
                                return this.length > num.length ? this.clone().iuor(num) : num.clone().iuor(this)
                            }, BN.prototype.iuand = function iuand(num) {
                                var b;
                                b = this.length > num.length ? num : this;
                                for (var i = 0; i < b.length; i++) this.words[i] &= num.words[i];
                                return this.length = b.length, this._strip()
                            }, BN.prototype.iand = function iand(num) {
                                return assert(0 == (this.negative | num.negative)), this.iuand(num)
                            }, BN.prototype.and = function and(num) {
                                return this.length > num.length ? this.clone().iand(num) : num.clone().iand(this)
                            }, BN.prototype.uand = function uand(num) {
                                return this.length > num.length ? this.clone().iuand(num) : num.clone().iuand(this)
                            }, BN.prototype.iuxor = function iuxor(num) {
                                var a, b;
                                this.length > num.length ? (a = this, b = num) : (a = num, b = this);
                                for (var i = 0; i < b.length; i++) this.words[i] = a.words[i] ^ b.words[i];
                                if (this !== a)
                                    for (; i < a.length; i++) this.words[i] = a.words[i];
                                return this.length = a.length, this._strip()
                            }, BN.prototype.ixor = function ixor(num) {
                                return assert(0 == (this.negative | num.negative)), this.iuxor(num)
                            }, BN.prototype.xor = function xor(num) {
                                return this.length > num.length ? this.clone().ixor(num) : num.clone().ixor(this)
                            }, BN.prototype.uxor = function uxor(num) {
                                return this.length > num.length ? this.clone().iuxor(num) : num.clone().iuxor(this)
                            }, BN.prototype.inotn = function inotn(width) {
                                assert("number" == typeof width && 0 <= width);
                                var bytesNeeded = 0 | _Mathceil(width / 26),
                                    bitsLeft = width % 26;
                                this._expand(bytesNeeded), 0 < bitsLeft && bytesNeeded--;
                                for (var i = 0; i < bytesNeeded; i++) this.words[i] = 67108863 & ~this.words[i];
                                return 0 < bitsLeft && (this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft), this._strip()
                            }, BN.prototype.notn = function notn(width) {
                                return this.clone().inotn(width)
                            }, BN.prototype.setn = function setn(bit, val) {
                                assert("number" == typeof bit && 0 <= bit);
                                var off = 0 | bit / 26,
                                    wbit = bit % 26;
                                return this._expand(off + 1), val ? this.words[off] |= 1 << wbit : this.words[off] &= ~(1 << wbit), this._strip()
                            }, BN.prototype.iadd = function iadd(num) {
                                var r;
                                if (0 !== this.negative && 0 === num.negative) return this.negative = 0, r = this.isub(num), this.negative ^= 1, this._normSign();
                                if (0 === this.negative && 0 !== num.negative) return num.negative = 0, r = this.isub(num), num.negative = 1, r._normSign();
                                var a, b;
                                this.length > num.length ? (a = this, b = num) : (a = num, b = this);
                                for (var carry = 0, i = 0; i < b.length; i++) r = (0 | a.words[i]) + (0 | b.words[i]) + carry, this.words[i] = 67108863 & r, carry = r >>> 26;
                                for (; 0 !== carry && i < a.length; i++) r = (0 | a.words[i]) + carry, this.words[i] = 67108863 & r, carry = r >>> 26;
                                if (this.length = a.length, 0 !== carry) this.words[this.length] = carry, this.length++;
                                else if (a !== this)
                                    for (; i < a.length; i++) this.words[i] = a.words[i];
                                return this
                            }, BN.prototype.add = function add(num) {
                                var res;
                                return 0 !== num.negative && 0 === this.negative ? (num.negative = 0, res = this.sub(num), num.negative ^= 1, res) : 0 === num.negative && 0 !== this.negative ? (this.negative = 0, res = num.sub(this), this.negative = 1, res) : this.length > num.length ? this.clone().iadd(num) : num.clone().iadd(this)
                            }, BN.prototype.isub = function isub(num) {
                                if (0 !== num.negative) {
                                    num.negative = 0;
                                    var r = this.iadd(num);
                                    return num.negative = 1, r._normSign()
                                }
                                if (0 !== this.negative) return this.negative = 0, this.iadd(num), this.negative = 1, this._normSign();
                                var cmp = this.cmp(num);
                                if (0 === cmp) return this.negative = 0, this.length = 1, this.words[0] = 0, this;
                                var a, b;
                                0 < cmp ? (a = this, b = num) : (a = num, b = this);
                                for (var carry = 0, i = 0; i < b.length; i++) r = (0 | a.words[i]) - (0 | b.words[i]) + carry, carry = r >> 26, this.words[i] = 67108863 & r;
                                for (; 0 !== carry && i < a.length; i++) r = (0 | a.words[i]) + carry, carry = r >> 26, this.words[i] = 67108863 & r;
                                if (0 === carry && i < a.length && a !== this)
                                    for (; i < a.length; i++) this.words[i] = a.words[i];
                                return this.length = _Mathmax(this.length, i), a !== this && (this.negative = 1), this._strip()
                            }, BN.prototype.sub = function sub(num) {
                                return this.clone().isub(num)
                            };
                            var comb10MulTo = function comb10MulTo(self, num, out) {
                                var a = self.words,
                                    b = num.words,
                                    o = out.words,
                                    c = 0,
                                    a0 = 0 | a[0],
                                    al0 = 8191 & a0,
                                    ah0 = a0 >>> 13,
                                    a1 = 0 | a[1],
                                    al1 = 8191 & a1,
                                    ah1 = a1 >>> 13,
                                    a2 = 0 | a[2],
                                    al2 = 8191 & a2,
                                    ah2 = a2 >>> 13,
                                    a3 = 0 | a[3],
                                    al3 = 8191 & a3,
                                    ah3 = a3 >>> 13,
                                    a4 = 0 | a[4],
                                    al4 = 8191 & a4,
                                    ah4 = a4 >>> 13,
                                    a5 = 0 | a[5],
                                    al5 = 8191 & a5,
                                    ah5 = a5 >>> 13,
                                    a6 = 0 | a[6],
                                    al6 = 8191 & a6,
                                    ah6 = a6 >>> 13,
                                    a7 = 0 | a[7],
                                    al7 = 8191 & a7,
                                    ah7 = a7 >>> 13,
                                    a8 = 0 | a[8],
                                    al8 = 8191 & a8,
                                    ah8 = a8 >>> 13,
                                    a9 = 0 | a[9],
                                    al9 = 8191 & a9,
                                    ah9 = a9 >>> 13,
                                    b0 = 0 | b[0],
                                    bl0 = 8191 & b0,
                                    bh0 = b0 >>> 13,
                                    b1 = 0 | b[1],
                                    bl1 = 8191 & b1,
                                    bh1 = b1 >>> 13,
                                    b2 = 0 | b[2],
                                    bl2 = 8191 & b2,
                                    bh2 = b2 >>> 13,
                                    b3 = 0 | b[3],
                                    bl3 = 8191 & b3,
                                    bh3 = b3 >>> 13,
                                    b4 = 0 | b[4],
                                    bl4 = 8191 & b4,
                                    bh4 = b4 >>> 13,
                                    b5 = 0 | b[5],
                                    bl5 = 8191 & b5,
                                    bh5 = b5 >>> 13,
                                    b6 = 0 | b[6],
                                    bl6 = 8191 & b6,
                                    bh6 = b6 >>> 13,
                                    b7 = 0 | b[7],
                                    bl7 = 8191 & b7,
                                    bh7 = b7 >>> 13,
                                    b8 = 0 | b[8],
                                    bl8 = 8191 & b8,
                                    bh8 = b8 >>> 13,
                                    b9 = 0 | b[9],
                                    bl9 = 8191 & b9,
                                    bh9 = b9 >>> 13,
                                    lo, mid, hi;
                                out.negative = self.negative ^ num.negative, out.length = 19, lo = _Mathimul(al0, bl0), mid = _Mathimul(al0, bh0), mid = 0 | mid + _Mathimul(ah0, bl0), hi = _Mathimul(ah0, bh0);
                                var w0 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w0 >>> 26), w0 &= 67108863, lo = _Mathimul(al1, bl0), mid = _Mathimul(al1, bh0), mid = 0 | mid + _Mathimul(ah1, bl0), hi = _Mathimul(ah1, bh0), lo = 0 | lo + _Mathimul(al0, bl1), mid = 0 | mid + _Mathimul(al0, bh1), mid = 0 | mid + _Mathimul(ah0, bl1), hi = 0 | hi + _Mathimul(ah0, bh1);
                                var w1 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w1 >>> 26), w1 &= 67108863, lo = _Mathimul(al2, bl0), mid = _Mathimul(al2, bh0), mid = 0 | mid + _Mathimul(ah2, bl0), hi = _Mathimul(ah2, bh0), lo = 0 | lo + _Mathimul(al1, bl1), mid = 0 | mid + _Mathimul(al1, bh1), mid = 0 | mid + _Mathimul(ah1, bl1), hi = 0 | hi + _Mathimul(ah1, bh1), lo = 0 | lo + _Mathimul(al0, bl2), mid = 0 | mid + _Mathimul(al0, bh2), mid = 0 | mid + _Mathimul(ah0, bl2), hi = 0 | hi + _Mathimul(ah0, bh2);
                                var w2 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w2 >>> 26), w2 &= 67108863, lo = _Mathimul(al3, bl0), mid = _Mathimul(al3, bh0), mid = 0 | mid + _Mathimul(ah3, bl0), hi = _Mathimul(ah3, bh0), lo = 0 | lo + _Mathimul(al2, bl1), mid = 0 | mid + _Mathimul(al2, bh1), mid = 0 | mid + _Mathimul(ah2, bl1), hi = 0 | hi + _Mathimul(ah2, bh1), lo = 0 | lo + _Mathimul(al1, bl2), mid = 0 | mid + _Mathimul(al1, bh2), mid = 0 | mid + _Mathimul(ah1, bl2), hi = 0 | hi + _Mathimul(ah1, bh2), lo = 0 | lo + _Mathimul(al0, bl3), mid = 0 | mid + _Mathimul(al0, bh3), mid = 0 | mid + _Mathimul(ah0, bl3), hi = 0 | hi + _Mathimul(ah0, bh3);
                                var w3 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w3 >>> 26), w3 &= 67108863, lo = _Mathimul(al4, bl0), mid = _Mathimul(al4, bh0), mid = 0 | mid + _Mathimul(ah4, bl0), hi = _Mathimul(ah4, bh0), lo = 0 | lo + _Mathimul(al3, bl1), mid = 0 | mid + _Mathimul(al3, bh1), mid = 0 | mid + _Mathimul(ah3, bl1), hi = 0 | hi + _Mathimul(ah3, bh1), lo = 0 | lo + _Mathimul(al2, bl2), mid = 0 | mid + _Mathimul(al2, bh2), mid = 0 | mid + _Mathimul(ah2, bl2), hi = 0 | hi + _Mathimul(ah2, bh2), lo = 0 | lo + _Mathimul(al1, bl3), mid = 0 | mid + _Mathimul(al1, bh3), mid = 0 | mid + _Mathimul(ah1, bl3), hi = 0 | hi + _Mathimul(ah1, bh3), lo = 0 | lo + _Mathimul(al0, bl4), mid = 0 | mid + _Mathimul(al0, bh4), mid = 0 | mid + _Mathimul(ah0, bl4), hi = 0 | hi + _Mathimul(ah0, bh4);
                                var w4 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w4 >>> 26), w4 &= 67108863, lo = _Mathimul(al5, bl0), mid = _Mathimul(al5, bh0), mid = 0 | mid + _Mathimul(ah5, bl0), hi = _Mathimul(ah5, bh0), lo = 0 | lo + _Mathimul(al4, bl1), mid = 0 | mid + _Mathimul(al4, bh1), mid = 0 | mid + _Mathimul(ah4, bl1), hi = 0 | hi + _Mathimul(ah4, bh1), lo = 0 | lo + _Mathimul(al3, bl2), mid = 0 | mid + _Mathimul(al3, bh2), mid = 0 | mid + _Mathimul(ah3, bl2), hi = 0 | hi + _Mathimul(ah3, bh2), lo = 0 | lo + _Mathimul(al2, bl3), mid = 0 | mid + _Mathimul(al2, bh3), mid = 0 | mid + _Mathimul(ah2, bl3), hi = 0 | hi + _Mathimul(ah2, bh3), lo = 0 | lo + _Mathimul(al1, bl4), mid = 0 | mid + _Mathimul(al1, bh4), mid = 0 | mid + _Mathimul(ah1, bl4), hi = 0 | hi + _Mathimul(ah1, bh4), lo = 0 | lo + _Mathimul(al0, bl5), mid = 0 | mid + _Mathimul(al0, bh5), mid = 0 | mid + _Mathimul(ah0, bl5), hi = 0 | hi + _Mathimul(ah0, bh5);
                                var w5 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w5 >>> 26), w5 &= 67108863, lo = _Mathimul(al6, bl0), mid = _Mathimul(al6, bh0), mid = 0 | mid + _Mathimul(ah6, bl0), hi = _Mathimul(ah6, bh0), lo = 0 | lo + _Mathimul(al5, bl1), mid = 0 | mid + _Mathimul(al5, bh1), mid = 0 | mid + _Mathimul(ah5, bl1), hi = 0 | hi + _Mathimul(ah5, bh1), lo = 0 | lo + _Mathimul(al4, bl2), mid = 0 | mid + _Mathimul(al4, bh2), mid = 0 | mid + _Mathimul(ah4, bl2), hi = 0 | hi + _Mathimul(ah4, bh2), lo = 0 | lo + _Mathimul(al3, bl3), mid = 0 | mid + _Mathimul(al3, bh3), mid = 0 | mid + _Mathimul(ah3, bl3), hi = 0 | hi + _Mathimul(ah3, bh3), lo = 0 | lo + _Mathimul(al2, bl4), mid = 0 | mid + _Mathimul(al2, bh4), mid = 0 | mid + _Mathimul(ah2, bl4), hi = 0 | hi + _Mathimul(ah2, bh4), lo = 0 | lo + _Mathimul(al1, bl5), mid = 0 | mid + _Mathimul(al1, bh5), mid = 0 | mid + _Mathimul(ah1, bl5), hi = 0 | hi + _Mathimul(ah1, bh5), lo = 0 | lo + _Mathimul(al0, bl6), mid = 0 | mid + _Mathimul(al0, bh6), mid = 0 | mid + _Mathimul(ah0, bl6), hi = 0 | hi + _Mathimul(ah0, bh6);
                                var w6 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w6 >>> 26), w6 &= 67108863, lo = _Mathimul(al7, bl0), mid = _Mathimul(al7, bh0), mid = 0 | mid + _Mathimul(ah7, bl0), hi = _Mathimul(ah7, bh0), lo = 0 | lo + _Mathimul(al6, bl1), mid = 0 | mid + _Mathimul(al6, bh1), mid = 0 | mid + _Mathimul(ah6, bl1), hi = 0 | hi + _Mathimul(ah6, bh1), lo = 0 | lo + _Mathimul(al5, bl2), mid = 0 | mid + _Mathimul(al5, bh2), mid = 0 | mid + _Mathimul(ah5, bl2), hi = 0 | hi + _Mathimul(ah5, bh2), lo = 0 | lo + _Mathimul(al4, bl3), mid = 0 | mid + _Mathimul(al4, bh3), mid = 0 | mid + _Mathimul(ah4, bl3), hi = 0 | hi + _Mathimul(ah4, bh3), lo = 0 | lo + _Mathimul(al3, bl4), mid = 0 | mid + _Mathimul(al3, bh4), mid = 0 | mid + _Mathimul(ah3, bl4), hi = 0 | hi + _Mathimul(ah3, bh4), lo = 0 | lo + _Mathimul(al2, bl5), mid = 0 | mid + _Mathimul(al2, bh5), mid = 0 | mid + _Mathimul(ah2, bl5), hi = 0 | hi + _Mathimul(ah2, bh5), lo = 0 | lo + _Mathimul(al1, bl6), mid = 0 | mid + _Mathimul(al1, bh6), mid = 0 | mid + _Mathimul(ah1, bl6), hi = 0 | hi + _Mathimul(ah1, bh6), lo = 0 | lo + _Mathimul(al0, bl7), mid = 0 | mid + _Mathimul(al0, bh7), mid = 0 | mid + _Mathimul(ah0, bl7), hi = 0 | hi + _Mathimul(ah0, bh7);
                                var w7 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w7 >>> 26), w7 &= 67108863, lo = _Mathimul(al8, bl0), mid = _Mathimul(al8, bh0), mid = 0 | mid + _Mathimul(ah8, bl0), hi = _Mathimul(ah8, bh0), lo = 0 | lo + _Mathimul(al7, bl1), mid = 0 | mid + _Mathimul(al7, bh1), mid = 0 | mid + _Mathimul(ah7, bl1), hi = 0 | hi + _Mathimul(ah7, bh1), lo = 0 | lo + _Mathimul(al6, bl2), mid = 0 | mid + _Mathimul(al6, bh2), mid = 0 | mid + _Mathimul(ah6, bl2), hi = 0 | hi + _Mathimul(ah6, bh2), lo = 0 | lo + _Mathimul(al5, bl3), mid = 0 | mid + _Mathimul(al5, bh3), mid = 0 | mid + _Mathimul(ah5, bl3), hi = 0 | hi + _Mathimul(ah5, bh3), lo = 0 | lo + _Mathimul(al4, bl4), mid = 0 | mid + _Mathimul(al4, bh4), mid = 0 | mid + _Mathimul(ah4, bl4), hi = 0 | hi + _Mathimul(ah4, bh4), lo = 0 | lo + _Mathimul(al3, bl5), mid = 0 | mid + _Mathimul(al3, bh5), mid = 0 | mid + _Mathimul(ah3, bl5), hi = 0 | hi + _Mathimul(ah3, bh5), lo = 0 | lo + _Mathimul(al2, bl6), mid = 0 | mid + _Mathimul(al2, bh6), mid = 0 | mid + _Mathimul(ah2, bl6), hi = 0 | hi + _Mathimul(ah2, bh6), lo = 0 | lo + _Mathimul(al1, bl7), mid = 0 | mid + _Mathimul(al1, bh7), mid = 0 | mid + _Mathimul(ah1, bl7), hi = 0 | hi + _Mathimul(ah1, bh7), lo = 0 | lo + _Mathimul(al0, bl8), mid = 0 | mid + _Mathimul(al0, bh8), mid = 0 | mid + _Mathimul(ah0, bl8), hi = 0 | hi + _Mathimul(ah0, bh8);
                                var w8 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w8 >>> 26), w8 &= 67108863, lo = _Mathimul(al9, bl0), mid = _Mathimul(al9, bh0), mid = 0 | mid + _Mathimul(ah9, bl0), hi = _Mathimul(ah9, bh0), lo = 0 | lo + _Mathimul(al8, bl1), mid = 0 | mid + _Mathimul(al8, bh1), mid = 0 | mid + _Mathimul(ah8, bl1), hi = 0 | hi + _Mathimul(ah8, bh1), lo = 0 | lo + _Mathimul(al7, bl2), mid = 0 | mid + _Mathimul(al7, bh2), mid = 0 | mid + _Mathimul(ah7, bl2), hi = 0 | hi + _Mathimul(ah7, bh2), lo = 0 | lo + _Mathimul(al6, bl3), mid = 0 | mid + _Mathimul(al6, bh3), mid = 0 | mid + _Mathimul(ah6, bl3), hi = 0 | hi + _Mathimul(ah6, bh3), lo = 0 | lo + _Mathimul(al5, bl4), mid = 0 | mid + _Mathimul(al5, bh4), mid = 0 | mid + _Mathimul(ah5, bl4), hi = 0 | hi + _Mathimul(ah5, bh4), lo = 0 | lo + _Mathimul(al4, bl5), mid = 0 | mid + _Mathimul(al4, bh5), mid = 0 | mid + _Mathimul(ah4, bl5), hi = 0 | hi + _Mathimul(ah4, bh5), lo = 0 | lo + _Mathimul(al3, bl6), mid = 0 | mid + _Mathimul(al3, bh6), mid = 0 | mid + _Mathimul(ah3, bl6), hi = 0 | hi + _Mathimul(ah3, bh6), lo = 0 | lo + _Mathimul(al2, bl7), mid = 0 | mid + _Mathimul(al2, bh7), mid = 0 | mid + _Mathimul(ah2, bl7), hi = 0 | hi + _Mathimul(ah2, bh7), lo = 0 | lo + _Mathimul(al1, bl8), mid = 0 | mid + _Mathimul(al1, bh8), mid = 0 | mid + _Mathimul(ah1, bl8), hi = 0 | hi + _Mathimul(ah1, bh8), lo = 0 | lo + _Mathimul(al0, bl9), mid = 0 | mid + _Mathimul(al0, bh9), mid = 0 | mid + _Mathimul(ah0, bl9), hi = 0 | hi + _Mathimul(ah0, bh9);
                                var w9 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w9 >>> 26), w9 &= 67108863, lo = _Mathimul(al9, bl1), mid = _Mathimul(al9, bh1), mid = 0 | mid + _Mathimul(ah9, bl1), hi = _Mathimul(ah9, bh1), lo = 0 | lo + _Mathimul(al8, bl2), mid = 0 | mid + _Mathimul(al8, bh2), mid = 0 | mid + _Mathimul(ah8, bl2), hi = 0 | hi + _Mathimul(ah8, bh2), lo = 0 | lo + _Mathimul(al7, bl3), mid = 0 | mid + _Mathimul(al7, bh3), mid = 0 | mid + _Mathimul(ah7, bl3), hi = 0 | hi + _Mathimul(ah7, bh3), lo = 0 | lo + _Mathimul(al6, bl4), mid = 0 | mid + _Mathimul(al6, bh4), mid = 0 | mid + _Mathimul(ah6, bl4), hi = 0 | hi + _Mathimul(ah6, bh4), lo = 0 | lo + _Mathimul(al5, bl5), mid = 0 | mid + _Mathimul(al5, bh5), mid = 0 | mid + _Mathimul(ah5, bl5), hi = 0 | hi + _Mathimul(ah5, bh5), lo = 0 | lo + _Mathimul(al4, bl6), mid = 0 | mid + _Mathimul(al4, bh6), mid = 0 | mid + _Mathimul(ah4, bl6), hi = 0 | hi + _Mathimul(ah4, bh6), lo = 0 | lo + _Mathimul(al3, bl7), mid = 0 | mid + _Mathimul(al3, bh7), mid = 0 | mid + _Mathimul(ah3, bl7), hi = 0 | hi + _Mathimul(ah3, bh7), lo = 0 | lo + _Mathimul(al2, bl8), mid = 0 | mid + _Mathimul(al2, bh8), mid = 0 | mid + _Mathimul(ah2, bl8), hi = 0 | hi + _Mathimul(ah2, bh8), lo = 0 | lo + _Mathimul(al1, bl9), mid = 0 | mid + _Mathimul(al1, bh9), mid = 0 | mid + _Mathimul(ah1, bl9), hi = 0 | hi + _Mathimul(ah1, bh9);
                                var w10 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w10 >>> 26), w10 &= 67108863, lo = _Mathimul(al9, bl2), mid = _Mathimul(al9, bh2), mid = 0 | mid + _Mathimul(ah9, bl2), hi = _Mathimul(ah9, bh2), lo = 0 | lo + _Mathimul(al8, bl3), mid = 0 | mid + _Mathimul(al8, bh3), mid = 0 | mid + _Mathimul(ah8, bl3), hi = 0 | hi + _Mathimul(ah8, bh3), lo = 0 | lo + _Mathimul(al7, bl4), mid = 0 | mid + _Mathimul(al7, bh4), mid = 0 | mid + _Mathimul(ah7, bl4), hi = 0 | hi + _Mathimul(ah7, bh4), lo = 0 | lo + _Mathimul(al6, bl5), mid = 0 | mid + _Mathimul(al6, bh5), mid = 0 | mid + _Mathimul(ah6, bl5), hi = 0 | hi + _Mathimul(ah6, bh5), lo = 0 | lo + _Mathimul(al5, bl6), mid = 0 | mid + _Mathimul(al5, bh6), mid = 0 | mid + _Mathimul(ah5, bl6), hi = 0 | hi + _Mathimul(ah5, bh6), lo = 0 | lo + _Mathimul(al4, bl7), mid = 0 | mid + _Mathimul(al4, bh7), mid = 0 | mid + _Mathimul(ah4, bl7), hi = 0 | hi + _Mathimul(ah4, bh7), lo = 0 | lo + _Mathimul(al3, bl8), mid = 0 | mid + _Mathimul(al3, bh8), mid = 0 | mid + _Mathimul(ah3, bl8), hi = 0 | hi + _Mathimul(ah3, bh8), lo = 0 | lo + _Mathimul(al2, bl9), mid = 0 | mid + _Mathimul(al2, bh9), mid = 0 | mid + _Mathimul(ah2, bl9), hi = 0 | hi + _Mathimul(ah2, bh9);
                                var w11 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w11 >>> 26), w11 &= 67108863, lo = _Mathimul(al9, bl3), mid = _Mathimul(al9, bh3), mid = 0 | mid + _Mathimul(ah9, bl3), hi = _Mathimul(ah9, bh3), lo = 0 | lo + _Mathimul(al8, bl4), mid = 0 | mid + _Mathimul(al8, bh4), mid = 0 | mid + _Mathimul(ah8, bl4), hi = 0 | hi + _Mathimul(ah8, bh4), lo = 0 | lo + _Mathimul(al7, bl5), mid = 0 | mid + _Mathimul(al7, bh5), mid = 0 | mid + _Mathimul(ah7, bl5), hi = 0 | hi + _Mathimul(ah7, bh5), lo = 0 | lo + _Mathimul(al6, bl6), mid = 0 | mid + _Mathimul(al6, bh6), mid = 0 | mid + _Mathimul(ah6, bl6), hi = 0 | hi + _Mathimul(ah6, bh6), lo = 0 | lo + _Mathimul(al5, bl7), mid = 0 | mid + _Mathimul(al5, bh7), mid = 0 | mid + _Mathimul(ah5, bl7), hi = 0 | hi + _Mathimul(ah5, bh7), lo = 0 | lo + _Mathimul(al4, bl8), mid = 0 | mid + _Mathimul(al4, bh8), mid = 0 | mid + _Mathimul(ah4, bl8), hi = 0 | hi + _Mathimul(ah4, bh8), lo = 0 | lo + _Mathimul(al3, bl9), mid = 0 | mid + _Mathimul(al3, bh9), mid = 0 | mid + _Mathimul(ah3, bl9), hi = 0 | hi + _Mathimul(ah3, bh9);
                                var w12 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w12 >>> 26), w12 &= 67108863, lo = _Mathimul(al9, bl4), mid = _Mathimul(al9, bh4), mid = 0 | mid + _Mathimul(ah9, bl4), hi = _Mathimul(ah9, bh4), lo = 0 | lo + _Mathimul(al8, bl5), mid = 0 | mid + _Mathimul(al8, bh5), mid = 0 | mid + _Mathimul(ah8, bl5), hi = 0 | hi + _Mathimul(ah8, bh5), lo = 0 | lo + _Mathimul(al7, bl6), mid = 0 | mid + _Mathimul(al7, bh6), mid = 0 | mid + _Mathimul(ah7, bl6), hi = 0 | hi + _Mathimul(ah7, bh6), lo = 0 | lo + _Mathimul(al6, bl7), mid = 0 | mid + _Mathimul(al6, bh7), mid = 0 | mid + _Mathimul(ah6, bl7), hi = 0 | hi + _Mathimul(ah6, bh7), lo = 0 | lo + _Mathimul(al5, bl8), mid = 0 | mid + _Mathimul(al5, bh8), mid = 0 | mid + _Mathimul(ah5, bl8), hi = 0 | hi + _Mathimul(ah5, bh8), lo = 0 | lo + _Mathimul(al4, bl9), mid = 0 | mid + _Mathimul(al4, bh9), mid = 0 | mid + _Mathimul(ah4, bl9), hi = 0 | hi + _Mathimul(ah4, bh9);
                                var w13 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w13 >>> 26), w13 &= 67108863, lo = _Mathimul(al9, bl5), mid = _Mathimul(al9, bh5), mid = 0 | mid + _Mathimul(ah9, bl5), hi = _Mathimul(ah9, bh5), lo = 0 | lo + _Mathimul(al8, bl6), mid = 0 | mid + _Mathimul(al8, bh6), mid = 0 | mid + _Mathimul(ah8, bl6), hi = 0 | hi + _Mathimul(ah8, bh6), lo = 0 | lo + _Mathimul(al7, bl7), mid = 0 | mid + _Mathimul(al7, bh7), mid = 0 | mid + _Mathimul(ah7, bl7), hi = 0 | hi + _Mathimul(ah7, bh7), lo = 0 | lo + _Mathimul(al6, bl8), mid = 0 | mid + _Mathimul(al6, bh8), mid = 0 | mid + _Mathimul(ah6, bl8), hi = 0 | hi + _Mathimul(ah6, bh8), lo = 0 | lo + _Mathimul(al5, bl9), mid = 0 | mid + _Mathimul(al5, bh9), mid = 0 | mid + _Mathimul(ah5, bl9), hi = 0 | hi + _Mathimul(ah5, bh9);
                                var w14 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w14 >>> 26), w14 &= 67108863, lo = _Mathimul(al9, bl6), mid = _Mathimul(al9, bh6), mid = 0 | mid + _Mathimul(ah9, bl6), hi = _Mathimul(ah9, bh6), lo = 0 | lo + _Mathimul(al8, bl7), mid = 0 | mid + _Mathimul(al8, bh7), mid = 0 | mid + _Mathimul(ah8, bl7), hi = 0 | hi + _Mathimul(ah8, bh7), lo = 0 | lo + _Mathimul(al7, bl8), mid = 0 | mid + _Mathimul(al7, bh8), mid = 0 | mid + _Mathimul(ah7, bl8), hi = 0 | hi + _Mathimul(ah7, bh8), lo = 0 | lo + _Mathimul(al6, bl9), mid = 0 | mid + _Mathimul(al6, bh9), mid = 0 | mid + _Mathimul(ah6, bl9), hi = 0 | hi + _Mathimul(ah6, bh9);
                                var w15 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w15 >>> 26), w15 &= 67108863, lo = _Mathimul(al9, bl7), mid = _Mathimul(al9, bh7), mid = 0 | mid + _Mathimul(ah9, bl7), hi = _Mathimul(ah9, bh7), lo = 0 | lo + _Mathimul(al8, bl8), mid = 0 | mid + _Mathimul(al8, bh8), mid = 0 | mid + _Mathimul(ah8, bl8), hi = 0 | hi + _Mathimul(ah8, bh8), lo = 0 | lo + _Mathimul(al7, bl9), mid = 0 | mid + _Mathimul(al7, bh9), mid = 0 | mid + _Mathimul(ah7, bl9), hi = 0 | hi + _Mathimul(ah7, bh9);
                                var w16 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w16 >>> 26), w16 &= 67108863, lo = _Mathimul(al9, bl8), mid = _Mathimul(al9, bh8), mid = 0 | mid + _Mathimul(ah9, bl8), hi = _Mathimul(ah9, bh8), lo = 0 | lo + _Mathimul(al8, bl9), mid = 0 | mid + _Mathimul(al8, bh9), mid = 0 | mid + _Mathimul(ah8, bl9), hi = 0 | hi + _Mathimul(ah8, bh9);
                                var w17 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                c = 0 | (0 | hi + (mid >>> 13)) + (w17 >>> 26), w17 &= 67108863, lo = _Mathimul(al9, bl9), mid = _Mathimul(al9, bh9), mid = 0 | mid + _Mathimul(ah9, bl9), hi = _Mathimul(ah9, bh9);
                                var w18 = 0 | (0 | c + lo) + ((8191 & mid) << 13);
                                return c = 0 | (0 | hi + (mid >>> 13)) + (w18 >>> 26), w18 &= 67108863, o[0] = w0, o[1] = w1, o[2] = w2, o[3] = w3, o[4] = w4, o[5] = w5, o[6] = w6, o[7] = w7, o[8] = w8, o[9] = w9, o[10] = w10, o[11] = w11, o[12] = w12, o[13] = w13, o[14] = w14, o[15] = w15, o[16] = w16, o[17] = w17, o[18] = w18, 0 !== c && (o[19] = c, out.length++), out
                            };
                            _Mathimul || (comb10MulTo = smallMulTo), BN.prototype.mulTo = function mulTo(num, out) {
                                var len = this.length + num.length,
                                    res;
                                return res = 10 === this.length && 10 === num.length ? comb10MulTo(this, num, out) : 63 > len ? smallMulTo(this, num, out) : 1024 > len ? bigMulTo(this, num, out) : jumboMulTo(this, num, out), res
                            }, FFTM.prototype.makeRBT = function makeRBT(N) {
                                for (var t = Array(N), l = BN.prototype._countBits(N) - 1, i = 0; i < N; i++) t[i] = this.revBin(i, l, N);
                                return t
                            }, FFTM.prototype.revBin = function revBin(x, l, N) {
                                if (0 === x || x === N - 1) return x;
                                for (var rb = 0, i = 0; i < l; i++) rb |= (1 & x) << l - i - 1, x >>= 1;
                                return rb
                            }, FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
                                for (var i = 0; i < N; i++) rtws[i] = rws[rbt[i]], itws[i] = iws[rbt[i]]
                            }, FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
                                this.permute(rbt, rws, iws, rtws, itws, N);
                                for (var s = 1; s < N; s <<= 1)
                                    for (var l = s << 1, rtwdf = _Mathcos(2 * _MathPI / l), itwdf = _Mathsin(2 * _MathPI / l), p = 0; p < N; p += l)
                                        for (var rtwdf_ = rtwdf, itwdf_ = itwdf, j = 0; j < s; j++) {
                                            var re = rtws[p + j],
                                                ie = itws[p + j],
                                                ro = rtws[p + j + s],
                                                io = itws[p + j + s],
                                                rx = rtwdf_ * ro - itwdf_ * io;
                                            io = rtwdf_ * io + itwdf_ * ro, ro = rx, rtws[p + j] = re + ro, itws[p + j] = ie + io, rtws[p + j + s] = re - ro, itws[p + j + s] = ie - io, j !== l && (rx = rtwdf * rtwdf_ - itwdf * itwdf_, itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_, rtwdf_ = rx)
                                        }
                            }, FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
                                var N = 1 | _Mathmax(m, n),
                                    odd = 1 & N,
                                    i = 0;
                                for (N = 0 | N / 2; N; N >>>= 1) i++;
                                return 1 << i + 1 + odd
                            }, FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
                                if (!(1 >= N))
                                    for (var i = 0, t; i < N / 2; i++) t = rws[i], rws[i] = rws[N - i - 1], rws[N - i - 1] = t, t = iws[i], iws[i] = -iws[N - i - 1], iws[N - i - 1] = -t
                            }, FFTM.prototype.normalize13b = function normalize13b(ws, N) {
                                for (var carry = 0, i = 0, w; i < N / 2; i++) w = 8192 * _Mathround(ws[2 * i + 1] / N) + _Mathround(ws[2 * i] / N) + carry, ws[i] = 67108863 & w, carry = 67108864 > w ? 0 : 0 | w / 67108864;
                                return ws
                            }, FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
                                for (var carry = 0, i = 0; i < len; i++) carry += 0 | ws[i], rws[2 * i] = 8191 & carry, carry >>>= 13, rws[2 * i + 1] = 8191 & carry, carry >>>= 13;
                                for (i = 2 * len; i < N; ++i) rws[i] = 0;
                                assert(0 === carry), assert(0 == (-8192 & carry))
                            }, FFTM.prototype.stub = function stub(N) {
                                for (var ph = Array(N), i = 0; i < N; i++) ph[i] = 0;
                                return ph
                            }, FFTM.prototype.mulp = function mulp(x, y, out) {
                                var N = 2 * this.guessLen13b(x.length, y.length),
                                    rbt = this.makeRBT(N),
                                    _ = this.stub(N),
                                    rws = Array(N),
                                    rwst = Array(N),
                                    iwst = Array(N),
                                    nrws = Array(N),
                                    nrwst = Array(N),
                                    niwst = Array(N),
                                    rmws = out.words;
                                rmws.length = N, this.convert13b(x.words, x.length, rws, N), this.convert13b(y.words, y.length, nrws, N), this.transform(rws, _, rwst, iwst, N, rbt), this.transform(nrws, _, nrwst, niwst, N, rbt);
                                for (var i = 0, rx; i < N; i++) rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i], iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i], rwst[i] = rx;
                                return this.conjugate(rwst, iwst, N), this.transform(rwst, iwst, rmws, _, N, rbt), this.conjugate(rmws, _, N), this.normalize13b(rmws, N), out.negative = x.negative ^ y.negative, out.length = x.length + y.length, out._strip()
                            }, BN.prototype.mul = function mul(num) {
                                var out = new BN(null);
                                return out.words = Array(this.length + num.length), this.mulTo(num, out)
                            }, BN.prototype.mulf = function mulf(num) {
                                var out = new BN(null);
                                return out.words = Array(this.length + num.length), jumboMulTo(this, num, out)
                            }, BN.prototype.imul = function imul(num) {
                                return this.clone().mulTo(num, this)
                            }, BN.prototype.imuln = function imuln(num) {
                                var isNegNum = 0 > num;
                                isNegNum && (num = -num), assert("number" == typeof num), assert(67108864 > num);
                                for (var carry = 0, i = 0; i < this.length; i++) {
                                    var w = (0 | this.words[i]) * num,
                                        lo = (67108863 & w) + (67108863 & carry);
                                    carry >>= 26, carry += 0 | w / 67108864, carry += lo >>> 26, this.words[i] = 67108863 & lo
                                }
                                return 0 !== carry && (this.words[i] = carry, this.length++), isNegNum ? this.ineg() : this
                            }, BN.prototype.muln = function muln(num) {
                                return this.clone().imuln(num)
                            }, BN.prototype.sqr = function sqr() {
                                return this.mul(this)
                            }, BN.prototype.isqr = function isqr() {
                                return this.imul(this.clone())
                            }, BN.prototype.pow = function pow(num) {
                                var w = toBitArray(num);
                                if (0 === w.length) return new BN(1);
                                for (var res = this, i = 0; i < w.length && 0 === w[i]; i++, res = res.sqr());
                                if (++i < w.length)
                                    for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) 0 !== w[i] && (res = res.mul(q));
                                return res
                            }, BN.prototype.iushln = function iushln(bits) {
                                assert("number" == typeof bits && 0 <= bits);
                                var r = bits % 26,
                                    s = (bits - r) / 26,
                                    carryMask = 67108863 >>> 26 - r << 26 - r,
                                    i;
                                if (0 != r) {
                                    var carry = 0;
                                    for (i = 0; i < this.length; i++) {
                                        var newCarry = this.words[i] & carryMask,
                                            c = (0 | this.words[i]) - newCarry << r;
                                        this.words[i] = c | carry, carry = newCarry >>> 26 - r
                                    }
                                    carry && (this.words[i] = carry, this.length++)
                                }
                                if (0 !== s) {
                                    for (i = this.length - 1; 0 <= i; i--) this.words[i + s] = this.words[i];
                                    for (i = 0; i < s; i++) this.words[i] = 0;
                                    this.length += s
                                }
                                return this._strip()
                            }, BN.prototype.ishln = function ishln(bits) {
                                return assert(0 === this.negative), this.iushln(bits)
                            }, BN.prototype.iushrn = function iushrn(bits, hint, extended) {
                                assert("number" == typeof bits && 0 <= bits);
                                var h;
                                h = hint ? (hint - hint % 26) / 26 : 0;
                                var r = bits % 26,
                                    s = _Mathmin((bits - r) / 26, this.length),
                                    mask = 67108863 ^ 67108863 >>> r << r,
                                    maskedWords = extended;
                                if (h -= s, h = _Mathmax(0, h), maskedWords) {
                                    for (var i = 0; i < s; i++) maskedWords.words[i] = this.words[i];
                                    maskedWords.length = s
                                }
                                if (0 === s);
                                else if (this.length > s)
                                    for (this.length -= s, i = 0; i < this.length; i++) this.words[i] = this.words[i + s];
                                else this.words[0] = 0, this.length = 1;
                                var carry = 0;
                                for (i = this.length - 1; 0 <= i && (0 !== carry || i >= h); i--) {
                                    var word = 0 | this.words[i];
                                    this.words[i] = carry << 26 - r | word >>> r, carry = word & mask
                                }
                                return maskedWords && 0 !== carry && (maskedWords.words[maskedWords.length++] = carry), 0 === this.length && (this.words[0] = 0, this.length = 1), this._strip()
                            }, BN.prototype.ishrn = function ishrn(bits, hint, extended) {
                                return assert(0 === this.negative), this.iushrn(bits, hint, extended)
                            }, BN.prototype.shln = function shln(bits) {
                                return this.clone().ishln(bits)
                            }, BN.prototype.ushln = function ushln(bits) {
                                return this.clone().iushln(bits)
                            }, BN.prototype.shrn = function shrn(bits) {
                                return this.clone().ishrn(bits)
                            }, BN.prototype.ushrn = function ushrn(bits) {
                                return this.clone().iushrn(bits)
                            }, BN.prototype.testn = function testn(bit) {
                                assert("number" == typeof bit && 0 <= bit);
                                var r = bit % 26,
                                    s = (bit - r) / 26,
                                    q = 1 << r;
                                if (this.length <= s) return !1;
                                var w = this.words[s];
                                return !!(w & q)
                            }, BN.prototype.imaskn = function imaskn(bits) {
                                assert("number" == typeof bits && 0 <= bits);
                                var r = bits % 26,
                                    s = (bits - r) / 26;
                                if (assert(0 === this.negative, "imaskn works only with positive numbers"), this.length <= s) return this;
                                if (0 != r && s++, this.length = _Mathmin(s, this.length), 0 != r) {
                                    var mask = 67108863 ^ 67108863 >>> r << r;
                                    this.words[this.length - 1] &= mask
                                }
                                return this._strip()
                            }, BN.prototype.maskn = function maskn(bits) {
                                return this.clone().imaskn(bits)
                            }, BN.prototype.iaddn = function iaddn(num) {
                                return assert("number" == typeof num), assert(67108864 > num), 0 > num ? this.isubn(-num) : 0 === this.negative ? this._iaddn(num) : 1 === this.length && (0 | this.words[0]) <= num ? (this.words[0] = num - (0 | this.words[0]), this.negative = 0, this) : (this.negative = 0, this.isubn(num), this.negative = 1, this)
                            }, BN.prototype._iaddn = function _iaddn(num) {
                                this.words[0] += num;
                                for (var i = 0; i < this.length && 67108864 <= this.words[i]; i++) this.words[i] -= 67108864, i == this.length - 1 ? this.words[i + 1] = 1 : this.words[i + 1]++;
                                return this.length = _Mathmax(this.length, i + 1), this
                            }, BN.prototype.isubn = function isubn(num) {
                                if (assert("number" == typeof num), assert(67108864 > num), 0 > num) return this.iaddn(-num);
                                if (0 !== this.negative) return this.negative = 0, this.iaddn(num), this.negative = 1, this;
                                if (this.words[0] -= num, 1 === this.length && 0 > this.words[0]) this.words[0] = -this.words[0], this.negative = 1;
                                else
                                    for (var i = 0; i < this.length && 0 > this.words[i]; i++) this.words[i] += 67108864, this.words[i + 1] -= 1;
                                return this._strip()
                            }, BN.prototype.addn = function addn(num) {
                                return this.clone().iaddn(num)
                            }, BN.prototype.subn = function subn(num) {
                                return this.clone().isubn(num)
                            }, BN.prototype.iabs = function iabs() {
                                return this.negative = 0, this
                            }, BN.prototype.abs = function abs() {
                                return this.clone().iabs()
                            }, BN.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
                                var len = num.length + shift,
                                    i;
                                this._expand(len);
                                var carry = 0,
                                    w;
                                for (i = 0; i < num.length; i++) {
                                    w = (0 | this.words[i + shift]) + carry;
                                    var right = (0 | num.words[i]) * mul;
                                    w -= 67108863 & right, carry = (w >> 26) - (0 | right / 67108864), this.words[i + shift] = 67108863 & w
                                }
                                for (; i < this.length - shift; i++) w = (0 | this.words[i + shift]) + carry, carry = w >> 26, this.words[i + shift] = 67108863 & w;
                                if (0 === carry) return this._strip();
                                for (assert(-1 === carry), carry = 0, i = 0; i < this.length; i++) w = -(0 | this.words[i]) + carry, carry = w >> 26, this.words[i] = 67108863 & w;
                                return this.negative = 1, this._strip()
                            }, BN.prototype._wordDiv = function _wordDiv(num, mode) {
                                var shift = this.length - num.length,
                                    a = this.clone(),
                                    b = num,
                                    bhi = 0 | b.words[b.length - 1],
                                    bhiBits = this._countBits(bhi);
                                shift = 26 - bhiBits, 0 != shift && (b = b.ushln(shift), a.iushln(shift), bhi = 0 | b.words[b.length - 1]);
                                var m = a.length - b.length,
                                    q;
                                if ("mod" !== mode) {
                                    q = new BN(null), q.length = m + 1, q.words = Array(q.length);
                                    for (var i = 0; i < q.length; i++) q.words[i] = 0
                                }
                                var diff = a.clone()._ishlnsubmul(b, 1, m);
                                0 === diff.negative && (a = diff, q && (q.words[m] = 1));
                                for (var j = m - 1, qj; 0 <= j; j--) {
                                    for (qj = 67108864 * (0 | a.words[b.length + j]) + (0 | a.words[b.length + j - 1]), qj = _Mathmin(0 | qj / bhi, 67108863), a._ishlnsubmul(b, qj, j); 0 !== a.negative;) qj--, a.negative = 0, a._ishlnsubmul(b, 1, j), a.isZero() || (a.negative ^= 1);
                                    q && (q.words[j] = qj)
                                }
                                return q && q._strip(), a._strip(), "div" !== mode && 0 !== shift && a.iushrn(shift), {
                                    div: q || null,
                                    mod: a
                                }
                            }, BN.prototype.divmod = function divmod(num, mode, positive) {
                                if (assert(!num.isZero()), this.isZero()) return {
                                    div: new BN(0),
                                    mod: new BN(0)
                                };
                                var div, mod, res;
                                return 0 !== this.negative && 0 === num.negative ? (res = this.neg().divmod(num, mode), "mod" !== mode && (div = res.div.neg()), "div" !== mode && (mod = res.mod.neg(), positive && 0 !== mod.negative && mod.iadd(num)), {
                                    div: div,
                                    mod: mod
                                }) : 0 === this.negative && 0 !== num.negative ? (res = this.divmod(num.neg(), mode), "mod" !== mode && (div = res.div.neg()), {
                                    div: div,
                                    mod: res.mod
                                }) : 0 == (this.negative & num.negative) ? num.length > this.length || 0 > this.cmp(num) ? {
                                    div: new BN(0),
                                    mod: this
                                } : 1 === num.length ? "div" === mode ? {
                                    div: this.divn(num.words[0]),
                                    mod: null
                                } : "mod" === mode ? {
                                    div: null,
                                    mod: new BN(this.modrn(num.words[0]))
                                } : {
                                    div: this.divn(num.words[0]),
                                    mod: new BN(this.modrn(num.words[0]))
                                } : this._wordDiv(num, mode) : (res = this.neg().divmod(num.neg(), mode), "div" !== mode && (mod = res.mod.neg(), positive && 0 !== mod.negative && mod.isub(num)), {
                                    div: res.div,
                                    mod: mod
                                })
                            }, BN.prototype.div = function div(num) {
                                return this.divmod(num, "div", !1).div
                            }, BN.prototype.mod = function mod(num) {
                                return this.divmod(num, "mod", !1).mod
                            }, BN.prototype.umod = function umod(num) {
                                return this.divmod(num, "mod", !0).mod
                            }, BN.prototype.divRound = function divRound(num) {
                                var dm = this.divmod(num);
                                if (dm.mod.isZero()) return dm.div;
                                var mod = 0 === dm.div.negative ? dm.mod : dm.mod.isub(num),
                                    half = num.ushrn(1),
                                    r2 = num.andln(1),
                                    cmp = mod.cmp(half);
                                return 0 > cmp || 1 === r2 && 0 === cmp ? dm.div : 0 === dm.div.negative ? dm.div.iaddn(1) : dm.div.isubn(1)
                            }, BN.prototype.modrn = function modrn(num) {
                                var isNegNum = 0 > num;
                                isNegNum && (num = -num), assert(67108863 >= num);
                                for (var p = 67108864 % num, acc = 0, i = this.length - 1; 0 <= i; i--) acc = (p * acc + (0 | this.words[i])) % num;
                                return isNegNum ? -acc : acc
                            }, BN.prototype.modn = function modn(num) {
                                return this.modrn(num)
                            }, BN.prototype.idivn = function idivn(num) {
                                var isNegNum = 0 > num;
                                isNegNum && (num = -num), assert(67108863 >= num);
                                for (var carry = 0, i = this.length - 1, w; 0 <= i; i--) w = (0 | this.words[i]) + 67108864 * carry, this.words[i] = 0 | w / num, carry = w % num;
                                return this._strip(), isNegNum ? this.ineg() : this
                            }, BN.prototype.divn = function divn(num) {
                                return this.clone().idivn(num)
                            }, BN.prototype.egcd = function egcd(p) {
                                assert(0 === p.negative), assert(!p.isZero());
                                var x = this,
                                    y = p.clone();
                                x = 0 === x.negative ? x.clone() : x.umod(p);
                                for (var A = new BN(1), B = new BN(0), C = new BN(0), D = new BN(1), g = 0; x.isEven() && y.isEven();) x.iushrn(1), y.iushrn(1), ++g;
                                for (var yp = y.clone(), xp = x.clone(); !x.isZero();) {
                                    for (var i = 0, im = 1; 0 == (x.words[0] & im) && 26 > i; ++i, im <<= 1);
                                    if (0 < i)
                                        for (x.iushrn(i); 0 < i--;)(A.isOdd() || B.isOdd()) && (A.iadd(yp), B.isub(xp)), A.iushrn(1), B.iushrn(1);
                                    for (var j = 0, jm = 1; 0 == (y.words[0] & jm) && 26 > j; ++j, jm <<= 1);
                                    if (0 < j)
                                        for (y.iushrn(j); 0 < j--;)(C.isOdd() || D.isOdd()) && (C.iadd(yp), D.isub(xp)), C.iushrn(1), D.iushrn(1);
                                    0 <= x.cmp(y) ? (x.isub(y), A.isub(C), B.isub(D)) : (y.isub(x), C.isub(A), D.isub(B))
                                }
                                return {
                                    a: C,
                                    b: D,
                                    gcd: y.iushln(g)
                                }
                            }, BN.prototype._invmp = function _invmp(p) {
                                assert(0 === p.negative), assert(!p.isZero());
                                var a = this,
                                    b = p.clone();
                                a = 0 === a.negative ? a.clone() : a.umod(p);
                                for (var x1 = new BN(1), x2 = new BN(0), delta = b.clone(); 0 < a.cmpn(1) && 0 < b.cmpn(1);) {
                                    for (var i = 0, im = 1; 0 == (a.words[0] & im) && 26 > i; ++i, im <<= 1);
                                    if (0 < i)
                                        for (a.iushrn(i); 0 < i--;) x1.isOdd() && x1.iadd(delta), x1.iushrn(1);
                                    for (var j = 0, jm = 1; 0 == (b.words[0] & jm) && 26 > j; ++j, jm <<= 1);
                                    if (0 < j)
                                        for (b.iushrn(j); 0 < j--;) x2.isOdd() && x2.iadd(delta), x2.iushrn(1);
                                    0 <= a.cmp(b) ? (a.isub(b), x1.isub(x2)) : (b.isub(a), x2.isub(x1))
                                }
                                var res;
                                return res = 0 === a.cmpn(1) ? x1 : x2, 0 > res.cmpn(0) && res.iadd(p), res
                            }, BN.prototype.gcd = function gcd(num) {
                                if (this.isZero()) return num.abs();
                                if (num.isZero()) return this.abs();
                                var a = this.clone(),
                                    b = num.clone();
                                a.negative = 0, b.negative = 0;
                                for (var shift = 0; a.isEven() && b.isEven(); shift++) a.iushrn(1), b.iushrn(1);
                                do {
                                    for (; a.isEven();) a.iushrn(1);
                                    for (; b.isEven();) b.iushrn(1);
                                    var r = a.cmp(b);
                                    if (0 > r) {
                                        var t = a;
                                        a = b, b = t
                                    } else if (0 === r || 0 === b.cmpn(1)) break;
                                    a.isub(b)
                                } while (!0);
                                return b.iushln(shift)
                            }, BN.prototype.invm = function invm(num) {
                                return this.egcd(num).a.umod(num)
                            }, BN.prototype.isEven = function isEven() {
                                return 0 == (1 & this.words[0])
                            }, BN.prototype.isOdd = function isOdd() {
                                return 1 == (1 & this.words[0])
                            }, BN.prototype.andln = function andln(num) {
                                return this.words[0] & num
                            }, BN.prototype.bincn = function bincn(bit) {
                                assert("number" == typeof bit);
                                var r = bit % 26,
                                    s = (bit - r) / 26,
                                    q = 1 << r;
                                if (this.length <= s) return this._expand(s + 1), this.words[s] |= q, this;
                                for (var carry = q, i = s, w; 0 !== carry && i < this.length; i++) w = 0 | this.words[i], w += carry, carry = w >>> 26, w &= 67108863, this.words[i] = w;
                                return 0 !== carry && (this.words[i] = carry, this.length++), this
                            }, BN.prototype.isZero = function isZero() {
                                return 1 === this.length && 0 === this.words[0]
                            }, BN.prototype.cmpn = function cmpn(num) {
                                var negative = 0 > num;
                                if (0 !== this.negative && !negative) return -1;
                                if (0 === this.negative && negative) return 1;
                                this._strip();
                                var res;
                                if (1 < this.length) res = 1;
                                else {
                                    negative && (num = -num), assert(67108863 >= num, "Number is too big");
                                    var w = 0 | this.words[0];
                                    res = w === num ? 0 : w < num ? -1 : 1
                                }
                                return 0 === this.negative ? res : 0 | -res
                            }, BN.prototype.cmp = function cmp(num) {
                                if (0 !== this.negative && 0 === num.negative) return -1;
                                if (0 === this.negative && 0 !== num.negative) return 1;
                                var res = this.ucmp(num);
                                return 0 === this.negative ? res : 0 | -res
                            }, BN.prototype.ucmp = function ucmp(num) {
                                if (this.length > num.length) return 1;
                                if (this.length < num.length) return -1;
                                for (var res = 0, i = this.length - 1; 0 <= i; i--) {
                                    var a = 0 | this.words[i],
                                        b = 0 | num.words[i];
                                    if (a != b) {
                                        a < b ? res = -1 : a > b && (res = 1);
                                        break
                                    }
                                }
                                return res
                            }, BN.prototype.gtn = function gtn(num) {
                                return 1 === this.cmpn(num)
                            }, BN.prototype.gt = function gt(num) {
                                return 1 === this.cmp(num)
                            }, BN.prototype.gten = function gten(num) {
                                return 0 <= this.cmpn(num)
                            }, BN.prototype.gte = function gte(num) {
                                return 0 <= this.cmp(num)
                            }, BN.prototype.ltn = function ltn(num) {
                                return -1 === this.cmpn(num)
                            }, BN.prototype.lt = function lt(num) {
                                return -1 === this.cmp(num)
                            }, BN.prototype.lten = function lten(num) {
                                return 0 >= this.cmpn(num)
                            }, BN.prototype.lte = function lte(num) {
                                return 0 >= this.cmp(num)
                            }, BN.prototype.eqn = function eqn(num) {
                                return 0 === this.cmpn(num)
                            }, BN.prototype.eq = function eq(num) {
                                return 0 === this.cmp(num)
                            }, BN.red = function red(num) {
                                return new Red(num)
                            }, BN.prototype.toRed = function toRed(ctx) {
                                return assert(!this.red, "Already a number in reduction context"), assert(0 === this.negative, "red works only with positives"), ctx.convertTo(this)._forceRed(ctx)
                            }, BN.prototype.fromRed = function fromRed() {
                                return assert(this.red, "fromRed works only with numbers in reduction context"), this.red.convertFrom(this)
                            }, BN.prototype._forceRed = function _forceRed(ctx) {
                                return this.red = ctx, this
                            }, BN.prototype.forceRed = function forceRed(ctx) {
                                return assert(!this.red, "Already a number in reduction context"), this._forceRed(ctx)
                            }, BN.prototype.redAdd = function redAdd(num) {
                                return assert(this.red, "redAdd works only with red numbers"), this.red.add(this, num)
                            }, BN.prototype.redIAdd = function redIAdd(num) {
                                return assert(this.red, "redIAdd works only with red numbers"), this.red.iadd(this, num)
                            }, BN.prototype.redSub = function redSub(num) {
                                return assert(this.red, "redSub works only with red numbers"), this.red.sub(this, num)
                            }, BN.prototype.redISub = function redISub(num) {
                                return assert(this.red, "redISub works only with red numbers"), this.red.isub(this, num)
                            }, BN.prototype.redShl = function redShl(num) {
                                return assert(this.red, "redShl works only with red numbers"), this.red.shl(this, num)
                            }, BN.prototype.redMul = function redMul(num) {
                                return assert(this.red, "redMul works only with red numbers"), this.red._verify2(this, num), this.red.mul(this, num)
                            }, BN.prototype.redIMul = function redIMul(num) {
                                return assert(this.red, "redMul works only with red numbers"), this.red._verify2(this, num), this.red.imul(this, num)
                            }, BN.prototype.redSqr = function redSqr() {
                                return assert(this.red, "redSqr works only with red numbers"), this.red._verify1(this), this.red.sqr(this)
                            }, BN.prototype.redISqr = function redISqr() {
                                return assert(this.red, "redISqr works only with red numbers"), this.red._verify1(this), this.red.isqr(this)
                            }, BN.prototype.redSqrt = function redSqrt() {
                                return assert(this.red, "redSqrt works only with red numbers"), this.red._verify1(this), this.red.sqrt(this)
                            }, BN.prototype.redInvm = function redInvm() {
                                return assert(this.red, "redInvm works only with red numbers"), this.red._verify1(this), this.red.invm(this)
                            }, BN.prototype.redNeg = function redNeg() {
                                return assert(this.red, "redNeg works only with red numbers"), this.red._verify1(this), this.red.neg(this)
                            }, BN.prototype.redPow = function redPow(num) {
                                return assert(this.red && !num.red, "redPow(normalNum)"), this.red._verify1(this), this.red.pow(this, num)
                            };
                            var primes = {
                                k256: null,
                                p224: null,
                                p192: null,
                                p25519: null
                            };
                            MPrime.prototype._tmp = function _tmp() {
                                var tmp = new BN(null);
                                return tmp.words = Array(_Mathceil(this.n / 13)), tmp
                            }, MPrime.prototype.ireduce = function ireduce(num) {
                                var r = num,
                                    rlen;
                                do this.split(r, this.tmp), r = this.imulK(r), r = r.iadd(this.tmp), rlen = r.bitLength(); while (rlen > this.n);
                                var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
                                return 0 === cmp ? (r.words[0] = 0, r.length = 1) : 0 < cmp ? r.isub(this.p) : void 0 === r.strip ? r._strip() : r.strip(), r
                            }, MPrime.prototype.split = function split(input, out) {
                                input.iushrn(this.n, 0, out)
                            }, MPrime.prototype.imulK = function imulK(num) {
                                return num.imul(this.k)
                            }, inherits(K256, MPrime), K256.prototype.split = function split(input, output) {
                                for (var mask = 4194303, outLen = _Mathmin(input.length, 9), i = 0; i < outLen; i++) output.words[i] = input.words[i];
                                if (output.length = outLen, 9 >= input.length) return input.words[0] = 0, void(input.length = 1);
                                var prev = input.words[9];
                                for (output.words[output.length++] = prev & mask, i = 10; i < input.length; i++) {
                                    var next = 0 | input.words[i];
                                    input.words[i - 10] = (next & mask) << 4 | prev >>> 22, prev = next
                                }
                                prev >>>= 22, input.words[i - 10] = prev, input.length -= 0 === prev && 10 < input.length ? 10 : 9
                            }, K256.prototype.imulK = function imulK(num) {
                                num.words[num.length] = 0, num.words[num.length + 1] = 0, num.length += 2;
                                for (var lo = 0, i = 0, w; i < num.length; i++) w = 0 | num.words[i], lo += 977 * w, num.words[i] = 67108863 & lo, lo = 64 * w + (0 | lo / 67108864);
                                return 0 === num.words[num.length - 1] && (num.length--, 0 === num.words[num.length - 1] && num.length--), num
                            }, inherits(P224, MPrime), inherits(P192, MPrime), inherits(P25519, MPrime), P25519.prototype.imulK = function imulK(num) {
                                for (var carry = 0, i = 0; i < num.length; i++) {
                                    var hi = 19 * (0 | num.words[i]) + carry,
                                        lo = 67108863 & hi;
                                    hi >>>= 26, num.words[i] = lo, carry = hi
                                }
                                return 0 !== carry && (num.words[num.length++] = carry), num
                            }, BN._prime = function prime(name) {
                                if (primes[name]) return primes[name];
                                var prime;
                                if ("k256" === name) prime = new K256;
                                else if ("p224" === name) prime = new P224;
                                else if ("p192" === name) prime = new P192;
                                else if ("p25519" === name) prime = new P25519;
                                else throw new Error("Unknown prime " + name);
                                return primes[name] = prime, prime
                            }, Red.prototype._verify1 = function _verify1(a) {
                                assert(0 === a.negative, "red works only with positives"), assert(a.red, "red works only with red numbers")
                            }, Red.prototype._verify2 = function _verify2(a, b) {
                                assert(0 == (a.negative | b.negative), "red works only with positives"), assert(a.red && a.red === b.red, "red works only with red numbers")
                            }, Red.prototype.imod = function imod(a) {
                                return this.prime ? this.prime.ireduce(a)._forceRed(this) : (move(a, a.umod(this.m)._forceRed(this)), a)
                            }, Red.prototype.neg = function neg(a) {
                                return a.isZero() ? a.clone() : this.m.sub(a)._forceRed(this)
                            }, Red.prototype.add = function add(a, b) {
                                this._verify2(a, b);
                                var res = a.add(b);
                                return 0 <= res.cmp(this.m) && res.isub(this.m), res._forceRed(this)
                            }, Red.prototype.iadd = function iadd(a, b) {
                                this._verify2(a, b);
                                var res = a.iadd(b);
                                return 0 <= res.cmp(this.m) && res.isub(this.m), res
                            }, Red.prototype.sub = function sub(a, b) {
                                this._verify2(a, b);
                                var res = a.sub(b);
                                return 0 > res.cmpn(0) && res.iadd(this.m), res._forceRed(this)
                            }, Red.prototype.isub = function isub(a, b) {
                                this._verify2(a, b);
                                var res = a.isub(b);
                                return 0 > res.cmpn(0) && res.iadd(this.m), res
                            }, Red.prototype.shl = function shl(a, num) {
                                return this._verify1(a), this.imod(a.ushln(num))
                            }, Red.prototype.imul = function imul(a, b) {
                                return this._verify2(a, b), this.imod(a.imul(b))
                            }, Red.prototype.mul = function mul(a, b) {
                                return this._verify2(a, b), this.imod(a.mul(b))
                            }, Red.prototype.isqr = function isqr(a) {
                                return this.imul(a, a.clone())
                            }, Red.prototype.sqr = function sqr(a) {
                                return this.mul(a, a)
                            }, Red.prototype.sqrt = function sqrt(a) {
                                if (a.isZero()) return a.clone();
                                var mod3 = this.m.andln(3);
                                if (assert(1 == mod3 % 2), 3 === mod3) {
                                    var pow = this.m.add(new BN(1)).iushrn(2);
                                    return this.pow(a, pow)
                                }
                                for (var q = this.m.subn(1), s = 0; !q.isZero() && 0 === q.andln(1);) s++, q.iushrn(1);
                                assert(!q.isZero());
                                var one = new BN(1).toRed(this),
                                    nOne = one.redNeg(),
                                    lpow = this.m.subn(1).iushrn(1),
                                    z = this.m.bitLength();
                                for (z = new BN(2 * z * z).toRed(this); 0 !== this.pow(z, lpow).cmp(nOne);) z.redIAdd(nOne);
                                for (var c = this.pow(z, q), r = this.pow(a, q.addn(1).iushrn(1)), t = this.pow(a, q), m = s; 0 !== t.cmp(one);) {
                                    for (var tmp = t, i = 0; 0 !== tmp.cmp(one); i++) tmp = tmp.redSqr();
                                    assert(i < m);
                                    var b = this.pow(c, new BN(1).iushln(m - i - 1));
                                    r = r.redMul(b), c = b.redSqr(), t = t.redMul(c), m = i
                                }
                                return r
                            }, Red.prototype.invm = function invm(a) {
                                var inv = a._invmp(this.m);
                                return 0 === inv.negative ? this.imod(inv) : (inv.negative = 0, this.imod(inv).redNeg())
                            }, Red.prototype.pow = function pow(a, num) {
                                if (num.isZero()) return new BN(1).toRed(this);
                                if (0 === num.cmpn(1)) return a.clone();
                                var windowSize = 4,
                                    wnd = Array(16);
                                wnd[0] = new BN(1).toRed(this), wnd[1] = a;
                                for (var i = 2; i < wnd.length; i++) wnd[i] = this.mul(wnd[i - 1], a);
                                var res = wnd[0],
                                    current = 0,
                                    currentLen = 0,
                                    start = num.bitLength() % 26;
                                for (0 === start && (start = 26), i = num.length - 1; 0 <= i; i--) {
                                    for (var word = num.words[i], j = start - 1, bit; 0 <= j; j--) {
                                        if (bit = 1 & word >> j, res !== wnd[0] && (res = this.sqr(res)), 0 === bit && 0 === current) {
                                            currentLen = 0;
                                            continue
                                        }
                                        current <<= 1, current |= bit, currentLen++, (4 === currentLen || 0 === i && 0 === j) && (res = this.mul(res, wnd[current]), currentLen = 0, current = 0)
                                    }
                                    start = 26
                                }
                                return res
                            }, Red.prototype.convertTo = function convertTo(num) {
                                var r = num.umod(this.m);
                                return r === num ? r.clone() : r
                            }, Red.prototype.convertFrom = function convertFrom(num) {
                                var res = num.clone();
                                return res.red = null, res
                            }, BN.mont = function mont(num) {
                                return new Mont(num)
                            }, inherits(Mont, Red), Mont.prototype.convertTo = function convertTo(num) {
                                return this.imod(num.ushln(this.shift))
                            }, Mont.prototype.convertFrom = function convertFrom(num) {
                                var r = this.imod(num.mul(this.rinv));
                                return r.red = null, r
                            }, Mont.prototype.imul = function imul(a, b) {
                                if (a.isZero() || b.isZero()) return a.words[0] = 0, a.length = 1, a;
                                var t = a.imul(b),
                                    c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
                                    u = t.isub(c).iushrn(this.shift),
                                    res = u;
                                return 0 <= u.cmp(this.m) ? res = u.isub(this.m) : 0 > u.cmpn(0) && (res = u.iadd(this.m)), res._forceRed(this)
                            }, Mont.prototype.mul = function mul(a, b) {
                                if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);
                                var t = a.mul(b),
                                    c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),
                                    u = t.isub(c).iushrn(this.shift),
                                    res = u;
                                return 0 <= u.cmp(this.m) ? res = u.isub(this.m) : 0 > u.cmpn(0) && (res = u.iadd(this.m)), res._forceRed(this)
                            }, Mont.prototype.invm = function invm(a) {
                                var res = this.imod(a._invmp(this.m).mul(this.r2));
                                return res._forceRed(this)
                            }
                        })("undefined" == typeof module || module, this)
                    }, {
                        buffer: 42
                    }],
                    41: [function (require, module, exports) {
                        function Rand(rand) {
                            this.rand = rand
                        }
                        var r;
                        if (module.exports = function rand(len) {
                                return r || (r = new Rand(null)), r.generate(len)
                            }, module.exports.Rand = Rand, Rand.prototype.generate = function generate(len) {
                                return this._rand(len)
                            }, Rand.prototype._rand = function _rand(n) {
                                if (this.rand.getBytes) return this.rand.getBytes(n);
                                for (var res = new Uint8Array(n), i = 0; i < res.length; i++) res[i] = this.rand.getByte();
                                return res
                            }, "object" == typeof self) self.crypto && self.crypto.getRandomValues ? Rand.prototype._rand = function _rand(n) {
                            var arr = new Uint8Array(n);
                            return self.crypto.getRandomValues(arr), arr
                        } : self.msCrypto && self.msCrypto.getRandomValues ? Rand.prototype._rand = function _rand(n) {
                            var arr = new Uint8Array(n);
                            return self.msCrypto.getRandomValues(arr), arr
                        } : "object" == typeof window && (Rand.prototype._rand = function () {
                            throw new Error("Not implemented yet")
                        });
                        else try {
                            var crypto = require("crypto");
                            if ("function" != typeof crypto.randomBytes) throw new Error("Not supported");
                            Rand.prototype._rand = function _rand(n) {
                                return crypto.randomBytes(n)
                            }
                        } catch (e) {}
                    }, {
                        crypto: 42
                    }],
                    42: [function (require, module, exports) {}, {}],
                    43: [function (require, module, exports) {
                        function asUInt32Array(buf) {
                            Buffer.isBuffer(buf) || (buf = Buffer.from(buf));
                            for (var len = 0 | buf.length / 4, out = Array(len), i = 0; i < len; i++) out[i] = buf.readUInt32BE(4 * i);
                            return out
                        }

                        function scrubVec(v) {
                            for (var i = 0; i < v.length; v++) v[i] = 0
                        }

                        function cryptBlock(M, keySchedule, SUB_MIX, SBOX, nRounds) {
                            for (var SUB_MIX0 = SUB_MIX[0], SUB_MIX1 = SUB_MIX[1], SUB_MIX2 = SUB_MIX[2], SUB_MIX3 = SUB_MIX[3], s0 = M[0] ^ keySchedule[0], s1 = M[1] ^ keySchedule[1], s2 = M[2] ^ keySchedule[2], s3 = M[3] ^ keySchedule[3], ksRow = 4, round = 1, t0, t1, t2, t3; round < nRounds; round++) t0 = SUB_MIX0[s0 >>> 24] ^ SUB_MIX1[255 & s1 >>> 16] ^ SUB_MIX2[255 & s2 >>> 8] ^ SUB_MIX3[255 & s3] ^ keySchedule[ksRow++], t1 = SUB_MIX0[s1 >>> 24] ^ SUB_MIX1[255 & s2 >>> 16] ^ SUB_MIX2[255 & s3 >>> 8] ^ SUB_MIX3[255 & s0] ^ keySchedule[ksRow++], t2 = SUB_MIX0[s2 >>> 24] ^ SUB_MIX1[255 & s3 >>> 16] ^ SUB_MIX2[255 & s0 >>> 8] ^ SUB_MIX3[255 & s1] ^ keySchedule[ksRow++], t3 = SUB_MIX0[s3 >>> 24] ^ SUB_MIX1[255 & s0 >>> 16] ^ SUB_MIX2[255 & s1 >>> 8] ^ SUB_MIX3[255 & s2] ^ keySchedule[ksRow++], s0 = t0, s1 = t1, s2 = t2, s3 = t3;
                            return t0 = (SBOX[s0 >>> 24] << 24 | SBOX[255 & s1 >>> 16] << 16 | SBOX[255 & s2 >>> 8] << 8 | SBOX[255 & s3]) ^ keySchedule[ksRow++], t1 = (SBOX[s1 >>> 24] << 24 | SBOX[255 & s2 >>> 16] << 16 | SBOX[255 & s3 >>> 8] << 8 | SBOX[255 & s0]) ^ keySchedule[ksRow++], t2 = (SBOX[s2 >>> 24] << 24 | SBOX[255 & s3 >>> 16] << 16 | SBOX[255 & s0 >>> 8] << 8 | SBOX[255 & s1]) ^ keySchedule[ksRow++], t3 = (SBOX[s3 >>> 24] << 24 | SBOX[255 & s0 >>> 16] << 16 | SBOX[255 & s1 >>> 8] << 8 | SBOX[255 & s2]) ^ keySchedule[ksRow++], t0 >>>= 0, t1 >>>= 0, t2 >>>= 0, t3 >>>= 0, [t0, t1, t2, t3]
                        }

                        function AES(key) {
                            this._key = asUInt32Array(key), this._reset()
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            RCON = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54],
                            G = function () {
                                for (var d = Array(256), j = 0; 256 > j; j++) d[j] = 128 > j ? j << 1 : 283 ^ j << 1;
                                for (var SBOX = [], INV_SBOX = [], SUB_MIX = [
                                        [],
                                        [],
                                        [],
                                        []
                                    ], INV_SUB_MIX = [
                                        [],
                                        [],
                                        [],
                                        []
                                    ], x = 0, xi = 0, i = 0, sx; 256 > i; ++i) {
                                    sx = xi ^ xi << 1 ^ xi << 2 ^ xi << 3 ^ xi << 4, sx = 99 ^ (sx >>> 8 ^ 255 & sx), SBOX[x] = sx, INV_SBOX[sx] = x;
                                    var x2 = d[x],
                                        x4 = d[x2],
                                        x8 = d[x4],
                                        t = 257 * d[sx] ^ 16843008 * sx;
                                    SUB_MIX[0][x] = t << 24 | t >>> 8, SUB_MIX[1][x] = t << 16 | t >>> 16, SUB_MIX[2][x] = t << 8 | t >>> 24, SUB_MIX[3][x] = t, t = 16843009 * x8 ^ 65537 * x4 ^ 257 * x2 ^ 16843008 * x, INV_SUB_MIX[0][sx] = t << 24 | t >>> 8, INV_SUB_MIX[1][sx] = t << 16 | t >>> 16, INV_SUB_MIX[2][sx] = t << 8 | t >>> 24, INV_SUB_MIX[3][sx] = t, 0 === x ? x = xi = 1 : (x = x2 ^ d[d[d[x8 ^ x2]]], xi ^= d[d[xi]])
                                }
                                return {
                                    SBOX: SBOX,
                                    INV_SBOX: INV_SBOX,
                                    SUB_MIX: SUB_MIX,
                                    INV_SUB_MIX: INV_SUB_MIX
                                }
                            }();
                        AES.blockSize = 16, AES.keySize = 32, AES.prototype.blockSize = AES.blockSize, AES.prototype.keySize = AES.keySize, AES.prototype._reset = function () {
                            for (var keyWords = this._key, keySize = keyWords.length, nRounds = keySize + 6, ksRows = 4 * (nRounds + 1), keySchedule = [], k = 0; k < keySize; k++) keySchedule[k] = keyWords[k];
                            for (k = keySize; k < ksRows; k++) {
                                var t = keySchedule[k - 1];
                                0 == k % keySize ? (t = t << 8 | t >>> 24, t = G.SBOX[t >>> 24] << 24 | G.SBOX[255 & t >>> 16] << 16 | G.SBOX[255 & t >>> 8] << 8 | G.SBOX[255 & t], t ^= RCON[0 | k / keySize] << 24) : 6 < keySize && 4 == k % keySize && (t = G.SBOX[t >>> 24] << 24 | G.SBOX[255 & t >>> 16] << 16 | G.SBOX[255 & t >>> 8] << 8 | G.SBOX[255 & t]), keySchedule[k] = keySchedule[k - keySize] ^ t
                            }
                            for (var invKeySchedule = [], ik = 0; ik < ksRows; ik++) {
                                var ksR = ksRows - ik,
                                    tt = keySchedule[ksR - (ik % 4 ? 0 : 4)];
                                invKeySchedule[ik] = 4 > ik || 4 >= ksR ? tt : G.INV_SUB_MIX[0][G.SBOX[tt >>> 24]] ^ G.INV_SUB_MIX[1][G.SBOX[255 & tt >>> 16]] ^ G.INV_SUB_MIX[2][G.SBOX[255 & tt >>> 8]] ^ G.INV_SUB_MIX[3][G.SBOX[255 & tt]]
                            }
                            this._nRounds = nRounds, this._keySchedule = keySchedule, this._invKeySchedule = invKeySchedule
                        }, AES.prototype.encryptBlockRaw = function (M) {
                            return M = asUInt32Array(M), cryptBlock(M, this._keySchedule, G.SUB_MIX, G.SBOX, this._nRounds)
                        }, AES.prototype.encryptBlock = function (M) {
                            var out = this.encryptBlockRaw(M),
                                buf = Buffer.allocUnsafe(16);
                            return buf.writeUInt32BE(out[0], 0), buf.writeUInt32BE(out[1], 4), buf.writeUInt32BE(out[2], 8), buf.writeUInt32BE(out[3], 12), buf
                        }, AES.prototype.decryptBlock = function (M) {
                            M = asUInt32Array(M);
                            var m1 = M[1];
                            M[1] = M[3], M[3] = m1;
                            var out = cryptBlock(M, this._invKeySchedule, G.INV_SUB_MIX, G.INV_SBOX, this._nRounds),
                                buf = Buffer.allocUnsafe(16);
                            return buf.writeUInt32BE(out[0], 0), buf.writeUInt32BE(out[3], 4), buf.writeUInt32BE(out[2], 8), buf.writeUInt32BE(out[1], 12), buf
                        }, AES.prototype.scrub = function () {
                            scrubVec(this._keySchedule), scrubVec(this._invKeySchedule), scrubVec(this._key)
                        }, module.exports.AES = AES
                    }, {
                        "safe-buffer": 235
                    }],
                    44: [function (require, module, exports) {
                        function xorTest(a, b) {
                            var out = 0;
                            a.length !== b.length && out++;
                            for (var len = _Mathmin(a.length, b.length), i = 0; i < len; ++i) out += a[i] ^ b[i];
                            return out
                        }

                        function calcIv(self, iv, ck) {
                            if (12 === iv.length) return self._finID = Buffer.concat([iv, Buffer.from([0, 0, 0, 1])]), Buffer.concat([iv, Buffer.from([0, 0, 0, 2])]);
                            var ghash = new GHASH(ck),
                                len = iv.length,
                                toPad = len % 16;
                            ghash.update(iv), toPad && (toPad = 16 - toPad, ghash.update(Buffer.alloc(toPad, 0))), ghash.update(Buffer.alloc(8, 0));
                            var ivBits = 8 * len,
                                tail = Buffer.alloc(8);
                            tail.writeUIntBE(ivBits, 0, 8), ghash.update(tail), self._finID = ghash.state;
                            var out = Buffer.from(self._finID);
                            return incr32(out), out
                        }

                        function StreamCipher(mode, key, iv, decrypt) {
                            Transform.call(this);
                            var h = Buffer.alloc(4, 0);
                            this._cipher = new aes.AES(key);
                            var ck = this._cipher.encryptBlock(h);
                            this._ghash = new GHASH(ck), iv = calcIv(this, iv, ck), this._prev = Buffer.from(iv), this._cache = Buffer.allocUnsafe(0), this._secCache = Buffer.allocUnsafe(0), this._decrypt = decrypt, this._alen = 0, this._len = 0, this._mode = mode, this._authTag = null, this._called = !1
                        }
                        var aes = require("./aes"),
                            Buffer = require("safe-buffer").Buffer,
                            Transform = require("cipher-base"),
                            inherits = require("inherits"),
                            GHASH = require("./ghash"),
                            xor = require("buffer-xor"),
                            incr32 = require("./incr32");
                        inherits(StreamCipher, Transform), StreamCipher.prototype._update = function (chunk) {
                            if (!this._called && this._alen) {
                                var rump = 16 - this._alen % 16;
                                16 > rump && (rump = Buffer.alloc(rump, 0), this._ghash.update(rump))
                            }
                            this._called = !0;
                            var out = this._mode.encrypt(this, chunk);
                            return this._decrypt ? this._ghash.update(chunk) : this._ghash.update(out), this._len += chunk.length, out
                        }, StreamCipher.prototype._final = function () {
                            if (this._decrypt && !this._authTag) throw new Error("Unsupported state or unable to authenticate data");
                            var tag = xor(this._ghash.final(8 * this._alen, 8 * this._len), this._cipher.encryptBlock(this._finID));
                            if (this._decrypt && xorTest(tag, this._authTag)) throw new Error("Unsupported state or unable to authenticate data");
                            this._authTag = tag, this._cipher.scrub()
                        }, StreamCipher.prototype.getAuthTag = function getAuthTag() {
                            if (this._decrypt || !Buffer.isBuffer(this._authTag)) throw new Error("Attempting to get auth tag in unsupported state");
                            return this._authTag
                        }, StreamCipher.prototype.setAuthTag = function setAuthTag(tag) {
                            if (!this._decrypt) throw new Error("Attempting to set auth tag in unsupported state");
                            this._authTag = tag
                        }, StreamCipher.prototype.setAAD = function setAAD(buf) {
                            if (this._called) throw new Error("Attempting to set AAD in unsupported state");
                            this._ghash.update(buf), this._alen += buf.length
                        }, module.exports = StreamCipher
                    }, {
                        "./aes": 43,
                        "./ghash": 48,
                        "./incr32": 49,
                        "buffer-xor": 75,
                        "cipher-base": 80,
                        inherits: 147,
                        "safe-buffer": 235
                    }],
                    45: [function (require, module, exports) {
                        function getCiphers() {
                            return Object.keys(modes)
                        }
                        var ciphers = require("./encrypter"),
                            deciphers = require("./decrypter"),
                            modes = require("./modes/list.json");
                        exports.createCipher = exports.Cipher = ciphers.createCipher, exports.createCipheriv = exports.Cipheriv = ciphers.createCipheriv, exports.createDecipher = exports.Decipher = deciphers.createDecipher, exports.createDecipheriv = exports.Decipheriv = deciphers.createDecipheriv, exports.listCiphers = exports.getCiphers = getCiphers
                    }, {
                        "./decrypter": 46,
                        "./encrypter": 47,
                        "./modes/list.json": 57
                    }],
                    46: [function (require, module, exports) {
                        function Decipher(mode, key, iv) {
                            Transform.call(this), this._cache = new Splitter, this._last = void 0, this._cipher = new aes.AES(key), this._prev = Buffer.from(iv), this._mode = mode, this._autopadding = !0
                        }

                        function Splitter() {
                            this.cache = Buffer.allocUnsafe(0)
                        }

                        function unpad(last) {
                            var padded = last[15];
                            if (1 > padded || 16 < padded) throw new Error("unable to decrypt data");
                            for (var i = -1; ++i < padded;)
                                if (last[i + (16 - padded)] !== padded) throw new Error("unable to decrypt data");
                            return 16 === padded ? void 0 : last.slice(0, 16 - padded)
                        }

                        function createDecipheriv(suite, password, iv) {
                            var config = MODES[suite.toLowerCase()];
                            if (!config) throw new TypeError("invalid suite type");
                            if ("string" == typeof iv && (iv = Buffer.from(iv)), "GCM" !== config.mode && iv.length !== config.iv) throw new TypeError("invalid iv length " + iv.length);
                            if ("string" == typeof password && (password = Buffer.from(password)), password.length !== config.key / 8) throw new TypeError("invalid key length " + password.length);
                            return "stream" === config.type ? new StreamCipher(config.module, password, iv, !0) : "auth" === config.type ? new AuthCipher(config.module, password, iv, !0) : new Decipher(config.module, password, iv)
                        }

                        function createDecipher(suite, password) {
                            var config = MODES[suite.toLowerCase()];
                            if (!config) throw new TypeError("invalid suite type");
                            var keys = ebtk(password, !1, config.key, config.iv);
                            return createDecipheriv(suite, keys.key, keys.iv)
                        }
                        var AuthCipher = require("./authCipher"),
                            Buffer = require("safe-buffer").Buffer,
                            MODES = require("./modes"),
                            StreamCipher = require("./streamCipher"),
                            Transform = require("cipher-base"),
                            aes = require("./aes"),
                            ebtk = require("evp_bytestokey"),
                            inherits = require("inherits");
                        inherits(Decipher, Transform), Decipher.prototype._update = function (data) {
                            this._cache.add(data);
                            for (var out = [], chunk, thing; chunk = this._cache.get(this._autopadding);) thing = this._mode.decrypt(this, chunk), out.push(thing);
                            return Buffer.concat(out)
                        }, Decipher.prototype._final = function () {
                            var chunk = this._cache.flush();
                            if (this._autopadding) return unpad(this._mode.decrypt(this, chunk));
                            if (chunk) throw new Error("data not multiple of block length")
                        }, Decipher.prototype.setAutoPadding = function (setTo) {
                            return this._autopadding = !!setTo, this
                        }, Splitter.prototype.add = function (data) {
                            this.cache = Buffer.concat([this.cache, data])
                        }, Splitter.prototype.get = function (autoPadding) {
                            var out;
                            if (autoPadding) {
                                if (16 < this.cache.length) return out = this.cache.slice(0, 16), this.cache = this.cache.slice(16), out;
                            } else if (16 <= this.cache.length) return out = this.cache.slice(0, 16), this.cache = this.cache.slice(16), out;
                            return null
                        }, Splitter.prototype.flush = function () {
                            if (this.cache.length) return this.cache
                        }, exports.createDecipher = createDecipher, exports.createDecipheriv = createDecipheriv
                    }, {
                        "./aes": 43,
                        "./authCipher": 44,
                        "./modes": 56,
                        "./streamCipher": 59,
                        "cipher-base": 80,
                        evp_bytestokey: 124,
                        inherits: 147,
                        "safe-buffer": 235
                    }],
                    47: [function (require, module, exports) {
                        function Cipher(mode, key, iv) {
                            Transform.call(this), this._cache = new Splitter, this._cipher = new aes.AES(key), this._prev = Buffer.from(iv), this._mode = mode, this._autopadding = !0
                        }

                        function Splitter() {
                            this.cache = Buffer.allocUnsafe(0)
                        }

                        function createCipheriv(suite, password, iv) {
                            var config = MODES[suite.toLowerCase()];
                            if (!config) throw new TypeError("invalid suite type");
                            if ("string" == typeof password && (password = Buffer.from(password)), password.length !== config.key / 8) throw new TypeError("invalid key length " + password.length);
                            if ("string" == typeof iv && (iv = Buffer.from(iv)), "GCM" !== config.mode && iv.length !== config.iv) throw new TypeError("invalid iv length " + iv.length);
                            return "stream" === config.type ? new StreamCipher(config.module, password, iv) : "auth" === config.type ? new AuthCipher(config.module, password, iv) : new Cipher(config.module, password, iv)
                        }

                        function createCipher(suite, password) {
                            var config = MODES[suite.toLowerCase()];
                            if (!config) throw new TypeError("invalid suite type");
                            var keys = ebtk(password, !1, config.key, config.iv);
                            return createCipheriv(suite, keys.key, keys.iv)
                        }
                        var MODES = require("./modes"),
                            AuthCipher = require("./authCipher"),
                            Buffer = require("safe-buffer").Buffer,
                            StreamCipher = require("./streamCipher"),
                            Transform = require("cipher-base"),
                            aes = require("./aes"),
                            ebtk = require("evp_bytestokey"),
                            inherits = require("inherits");
                        inherits(Cipher, Transform), Cipher.prototype._update = function (data) {
                            this._cache.add(data);
                            for (var out = [], chunk, thing; chunk = this._cache.get();) thing = this._mode.encrypt(this, chunk), out.push(thing);
                            return Buffer.concat(out)
                        };
                        var PADDING = Buffer.alloc(16, 16);
                        Cipher.prototype._final = function () {
                            var chunk = this._cache.flush();
                            if (this._autopadding) return chunk = this._mode.encrypt(this, chunk), this._cipher.scrub(), chunk;
                            if (!chunk.equals(PADDING)) throw this._cipher.scrub(), new Error("data not multiple of block length")
                        }, Cipher.prototype.setAutoPadding = function (setTo) {
                            return this._autopadding = !!setTo, this
                        }, Splitter.prototype.add = function (data) {
                            this.cache = Buffer.concat([this.cache, data])
                        }, Splitter.prototype.get = function () {
                            if (15 < this.cache.length) {
                                var out = this.cache.slice(0, 16);
                                return this.cache = this.cache.slice(16), out
                            }
                            return null
                        }, Splitter.prototype.flush = function () {
                            for (var len = 16 - this.cache.length, padBuff = Buffer.allocUnsafe(len), i = -1; ++i < len;) padBuff.writeUInt8(len, i);
                            return Buffer.concat([this.cache, padBuff])
                        }, exports.createCipheriv = createCipheriv, exports.createCipher = createCipher
                    }, {
                        "./aes": 43,
                        "./authCipher": 44,
                        "./modes": 56,
                        "./streamCipher": 59,
                        "cipher-base": 80,
                        evp_bytestokey: 124,
                        inherits: 147,
                        "safe-buffer": 235
                    }],
                    48: [function (require, module, exports) {
                        function toArray(buf) {
                            return [buf.readUInt32BE(0), buf.readUInt32BE(4), buf.readUInt32BE(8), buf.readUInt32BE(12)]
                        }

                        function fromArray(out) {
                            var buf = Buffer.allocUnsafe(16);
                            return buf.writeUInt32BE(out[0] >>> 0, 0), buf.writeUInt32BE(out[1] >>> 0, 4), buf.writeUInt32BE(out[2] >>> 0, 8), buf.writeUInt32BE(out[3] >>> 0, 12), buf
                        }

                        function GHASH(key) {
                            this.h = key, this.state = Buffer.alloc(16, 0), this.cache = Buffer.allocUnsafe(0)
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            ZEROES = Buffer.alloc(16, 0);
                        GHASH.prototype.ghash = function (block) {
                            for (var i = -1; ++i < block.length;) this.state[i] ^= block[i];
                            this._multiply()
                        }, GHASH.prototype._multiply = function () {
                            for (var Vi = toArray(this.h), Zi = [0, 0, 0, 0], i = -1, j, xi, lsbVi; 128 > ++i;) {
                                for (xi = 0 != (this.state[~~(i / 8)] & 1 << 7 - i % 8), xi && (Zi[0] ^= Vi[0], Zi[1] ^= Vi[1], Zi[2] ^= Vi[2], Zi[3] ^= Vi[3]), lsbVi = 0 != (1 & Vi[3]), j = 3; 0 < j; j--) Vi[j] = Vi[j] >>> 1 | (1 & Vi[j - 1]) << 31;
                                Vi[0] >>>= 1, lsbVi && (Vi[0] ^= -520093696)
                            }
                            this.state = fromArray(Zi)
                        }, GHASH.prototype.update = function (buf) {
                            this.cache = Buffer.concat([this.cache, buf]);
                            for (var chunk; 16 <= this.cache.length;) chunk = this.cache.slice(0, 16), this.cache = this.cache.slice(16), this.ghash(chunk)
                        }, GHASH.prototype.final = function (abl, bl) {
                            return this.cache.length && this.ghash(Buffer.concat([this.cache, ZEROES], 16)), this.ghash(fromArray([0, abl, 0, bl])), this.state
                        }, module.exports = GHASH
                    }, {
                        "safe-buffer": 235
                    }],
                    49: [function (require, module, exports) {
                        function incr32(iv) {
                            for (var len = iv.length, item; len--;)
                                if (item = iv.readUInt8(len), 255 === item) iv.writeUInt8(0, len);
                                else {
                                    item++, iv.writeUInt8(item, len);
                                    break
                                }
                        }
                        module.exports = incr32
                    }, {}],
                    50: [function (require, module, exports) {
                        var xor = require("buffer-xor");
                        exports.encrypt = function (self, block) {
                            var data = xor(block, self._prev);
                            return self._prev = self._cipher.encryptBlock(data), self._prev
                        }, exports.decrypt = function (self, block) {
                            var pad = self._prev;
                            self._prev = block;
                            var out = self._cipher.decryptBlock(block);
                            return xor(out, pad)
                        }
                    }, {
                        "buffer-xor": 75
                    }],
                    51: [function (require, module, exports) {
                        function encryptStart(self, data, decrypt) {
                            var len = data.length,
                                out = xor(data, self._cache);
                            return self._cache = self._cache.slice(len), self._prev = Buffer.concat([self._prev, decrypt ? data : out]), out
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            xor = require("buffer-xor");
                        exports.encrypt = function (self, data, decrypt) {
                            for (var out = Buffer.allocUnsafe(0), len; data.length;)
                                if (0 === self._cache.length && (self._cache = self._cipher.encryptBlock(self._prev), self._prev = Buffer.allocUnsafe(0)), self._cache.length <= data.length) len = self._cache.length, out = Buffer.concat([out, encryptStart(self, data.slice(0, len), decrypt)]), data = data.slice(len);
                                else {
                                    out = Buffer.concat([out, encryptStart(self, data, decrypt)]);
                                    break
                                } return out
                        }
                    }, {
                        "buffer-xor": 75,
                        "safe-buffer": 235
                    }],
                    52: [function (require, module, exports) {
                        function encryptByte(self, byteParam, decrypt) {
                            for (var i = -1, len = 8, out = 0, pad, bit, value; ++i < len;) pad = self._cipher.encryptBlock(self._prev), bit = byteParam & 1 << 7 - i ? 128 : 0, value = pad[0] ^ bit, out += (128 & value) >> i % 8, self._prev = shiftIn(self._prev, decrypt ? bit : value);
                            return out
                        }

                        function shiftIn(buffer, value) {
                            var len = buffer.length,
                                i = -1,
                                out = Buffer.allocUnsafe(buffer.length);
                            for (buffer = Buffer.concat([buffer, Buffer.from([value])]); ++i < len;) out[i] = buffer[i] << 1 | buffer[i + 1] >> 7;
                            return out
                        }
                        var Buffer = require("safe-buffer").Buffer;
                        exports.encrypt = function (self, chunk, decrypt) {
                            for (var len = chunk.length, out = Buffer.allocUnsafe(len), i = -1; ++i < len;) out[i] = encryptByte(self, chunk[i], decrypt);
                            return out
                        }
                    }, {
                        "safe-buffer": 235
                    }],
                    53: [function (require, module, exports) {
                        function encryptByte(self, byteParam, decrypt) {
                            var pad = self._cipher.encryptBlock(self._prev),
                                out = pad[0] ^ byteParam;
                            return self._prev = Buffer.concat([self._prev.slice(1), Buffer.from([decrypt ? byteParam : out])]), out
                        }
                        var Buffer = require("safe-buffer").Buffer;
                        exports.encrypt = function (self, chunk, decrypt) {
                            for (var len = chunk.length, out = Buffer.allocUnsafe(len), i = -1; ++i < len;) out[i] = encryptByte(self, chunk[i], decrypt);
                            return out
                        }
                    }, {
                        "safe-buffer": 235
                    }],
                    54: [function (require, module, exports) {
                        function getBlock(self) {
                            var out = self._cipher.encryptBlockRaw(self._prev);
                            return incr32(self._prev), out
                        }
                        var xor = require("buffer-xor"),
                            Buffer = require("safe-buffer").Buffer,
                            incr32 = require("../incr32"),
                            blockSize = 16;
                        exports.encrypt = function (self, chunk) {
                            var chunkNum = _Mathceil(chunk.length / blockSize),
                                start = self._cache.length;
                            self._cache = Buffer.concat([self._cache, Buffer.allocUnsafe(chunkNum * blockSize)]);
                            for (var i = 0; i < chunkNum; i++) {
                                var out = getBlock(self),
                                    offset = start + i * blockSize;
                                self._cache.writeUInt32BE(out[0], offset + 0), self._cache.writeUInt32BE(out[1], offset + 4), self._cache.writeUInt32BE(out[2], offset + 8), self._cache.writeUInt32BE(out[3], offset + 12)
                            }
                            var pad = self._cache.slice(0, chunk.length);
                            return self._cache = self._cache.slice(chunk.length), xor(chunk, pad)
                        }
                    }, {
                        "../incr32": 49,
                        "buffer-xor": 75,
                        "safe-buffer": 235
                    }],
                    55: [function (require, module, exports) {
                        exports.encrypt = function (self, block) {
                            return self._cipher.encryptBlock(block)
                        }, exports.decrypt = function (self, block) {
                            return self._cipher.decryptBlock(block)
                        }
                    }, {}],
                    56: [function (require, module, exports) {
                        var modeModules = {
                                ECB: require("./ecb"),
                                CBC: require("./cbc"),
                                CFB: require("./cfb"),
                                CFB8: require("./cfb8"),
                                CFB1: require("./cfb1"),
                                OFB: require("./ofb"),
                                CTR: require("./ctr"),
                                GCM: require("./ctr")
                            },
                            modes = require("./list.json");
                        for (var key in modes) modes[key].module = modeModules[modes[key].mode];
                        module.exports = modes
                    }, {
                        "./cbc": 50,
                        "./cfb": 51,
                        "./cfb1": 52,
                        "./cfb8": 53,
                        "./ctr": 54,
                        "./ecb": 55,
                        "./list.json": 57,
                        "./ofb": 58
                    }],
                    57: [function (require, module, exports) {
                        module.exports = {
                            "aes-128-ecb": {
                                cipher: "AES",
                                key: 128,
                                iv: 0,
                                mode: "ECB",
                                type: "block"
                            },
                            "aes-192-ecb": {
                                cipher: "AES",
                                key: 192,
                                iv: 0,
                                mode: "ECB",
                                type: "block"
                            },
                            "aes-256-ecb": {
                                cipher: "AES",
                                key: 256,
                                iv: 0,
                                mode: "ECB",
                                type: "block"
                            },
                            "aes-128-cbc": {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "CBC",
                                type: "block"
                            },
                            "aes-192-cbc": {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "CBC",
                                type: "block"
                            },
                            "aes-256-cbc": {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "CBC",
                                type: "block"
                            },
                            aes128: {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "CBC",
                                type: "block"
                            },
                            aes192: {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "CBC",
                                type: "block"
                            },
                            aes256: {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "CBC",
                                type: "block"
                            },
                            "aes-128-cfb": {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "CFB",
                                type: "stream"
                            },
                            "aes-192-cfb": {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "CFB",
                                type: "stream"
                            },
                            "aes-256-cfb": {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "CFB",
                                type: "stream"
                            },
                            "aes-128-cfb8": {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "CFB8",
                                type: "stream"
                            },
                            "aes-192-cfb8": {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "CFB8",
                                type: "stream"
                            },
                            "aes-256-cfb8": {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "CFB8",
                                type: "stream"
                            },
                            "aes-128-cfb1": {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "CFB1",
                                type: "stream"
                            },
                            "aes-192-cfb1": {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "CFB1",
                                type: "stream"
                            },
                            "aes-256-cfb1": {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "CFB1",
                                type: "stream"
                            },
                            "aes-128-ofb": {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "OFB",
                                type: "stream"
                            },
                            "aes-192-ofb": {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "OFB",
                                type: "stream"
                            },
                            "aes-256-ofb": {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "OFB",
                                type: "stream"
                            },
                            "aes-128-ctr": {
                                cipher: "AES",
                                key: 128,
                                iv: 16,
                                mode: "CTR",
                                type: "stream"
                            },
                            "aes-192-ctr": {
                                cipher: "AES",
                                key: 192,
                                iv: 16,
                                mode: "CTR",
                                type: "stream"
                            },
                            "aes-256-ctr": {
                                cipher: "AES",
                                key: 256,
                                iv: 16,
                                mode: "CTR",
                                type: "stream"
                            },
                            "aes-128-gcm": {
                                cipher: "AES",
                                key: 128,
                                iv: 12,
                                mode: "GCM",
                                type: "auth"
                            },
                            "aes-192-gcm": {
                                cipher: "AES",
                                key: 192,
                                iv: 12,
                                mode: "GCM",
                                type: "auth"
                            },
                            "aes-256-gcm": {
                                cipher: "AES",
                                key: 256,
                                iv: 12,
                                mode: "GCM",
                                type: "auth"
                            }
                        }
                    }, {}],
                    58: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function getBlock(self) {
                                    return self._prev = self._cipher.encryptBlock(self._prev), self._prev
                                }
                                var xor = require("buffer-xor");
                                exports.encrypt = function (self, chunk) {
                                    for (; self._cache.length < chunk.length;) self._cache = Buffer.concat([self._cache, getBlock(self)]);
                                    var pad = self._cache.slice(0, chunk.length);
                                    return self._cache = self._cache.slice(chunk.length), xor(chunk, pad)
                                }
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76,
                        "buffer-xor": 75
                    }],
                    59: [function (require, module, exports) {
                        function StreamCipher(mode, key, iv, decrypt) {
                            Transform.call(this), this._cipher = new aes.AES(key), this._prev = Buffer.from(iv), this._cache = Buffer.allocUnsafe(0), this._secCache = Buffer.allocUnsafe(0), this._decrypt = decrypt, this._mode = mode
                        }
                        var aes = require("./aes"),
                            Buffer = require("safe-buffer").Buffer,
                            Transform = require("cipher-base"),
                            inherits = require("inherits");
                        inherits(StreamCipher, Transform), StreamCipher.prototype._update = function (chunk) {
                            return this._mode.encrypt(this, chunk, this._decrypt)
                        }, StreamCipher.prototype._final = function () {
                            this._cipher.scrub()
                        }, module.exports = StreamCipher
                    }, {
                        "./aes": 43,
                        "cipher-base": 80,
                        inherits: 147,
                        "safe-buffer": 235
                    }],
                    60: [function (require, module, exports) {
                        function createCipher(suite, password) {
                            suite = suite.toLowerCase();
                            var keyLen, ivLen;
                            if (aesModes[suite]) keyLen = aesModes[suite].key, ivLen = aesModes[suite].iv;
                            else if (desModes[suite]) keyLen = 8 * desModes[suite].key, ivLen = desModes[suite].iv;
                            else throw new TypeError("invalid suite type");
                            var keys = ebtk(password, !1, keyLen, ivLen);
                            return createCipheriv(suite, keys.key, keys.iv)
                        }

                        function createDecipher(suite, password) {
                            suite = suite.toLowerCase();
                            var keyLen, ivLen;
                            if (aesModes[suite]) keyLen = aesModes[suite].key, ivLen = aesModes[suite].iv;
                            else if (desModes[suite]) keyLen = 8 * desModes[suite].key, ivLen = desModes[suite].iv;
                            else throw new TypeError("invalid suite type");
                            var keys = ebtk(password, !1, keyLen, ivLen);
                            return createDecipheriv(suite, keys.key, keys.iv)
                        }

                        function createCipheriv(suite, key, iv) {
                            if (suite = suite.toLowerCase(), aesModes[suite]) return aes.createCipheriv(suite, key, iv);
                            if (desModes[suite]) return new DES({
                                key: key,
                                iv: iv,
                                mode: suite
                            });
                            throw new TypeError("invalid suite type")
                        }

                        function createDecipheriv(suite, key, iv) {
                            if (suite = suite.toLowerCase(), aesModes[suite]) return aes.createDecipheriv(suite, key, iv);
                            if (desModes[suite]) return new DES({
                                key: key,
                                iv: iv,
                                mode: suite,
                                decrypt: !0
                            });
                            throw new TypeError("invalid suite type")
                        }

                        function getCiphers() {
                            return Object.keys(desModes).concat(aes.getCiphers())
                        }
                        var DES = require("browserify-des"),
                            aes = require("browserify-aes/browser"),
                            aesModes = require("browserify-aes/modes"),
                            desModes = require("browserify-des/modes"),
                            ebtk = require("evp_bytestokey");
                        exports.createCipher = exports.Cipher = createCipher, exports.createCipheriv = exports.Cipheriv = createCipheriv, exports.createDecipher = exports.Decipher = createDecipher, exports.createDecipheriv = exports.Decipheriv = createDecipheriv, exports.listCiphers = exports.getCiphers = getCiphers
                    }, {
                        "browserify-aes/browser": 45,
                        "browserify-aes/modes": 56,
                        "browserify-des": 61,
                        "browserify-des/modes": 62,
                        evp_bytestokey: 124
                    }],
                    61: [function (require, module, exports) {
                        function DES(opts) {
                            CipherBase.call(this);
                            var modeName = opts.mode.toLowerCase(),
                                mode = modes[modeName],
                                type;
                            type = opts.decrypt ? "decrypt" : "encrypt";
                            var key = opts.key;
                            Buffer.isBuffer(key) || (key = Buffer.from(key)), ("des-ede" === modeName || "des-ede-cbc" === modeName) && (key = Buffer.concat([key, key.slice(0, 8)]));
                            var iv = opts.iv;
                            Buffer.isBuffer(iv) || (iv = Buffer.from(iv)), this._des = mode.create({
                                key: key,
                                iv: iv,
                                type: type
                            })
                        }
                        var CipherBase = require("cipher-base"),
                            des = require("des.js"),
                            inherits = require("inherits"),
                            Buffer = require("safe-buffer").Buffer,
                            modes = {
                                "des-ede3-cbc": des.CBC.instantiate(des.EDE),
                                "des-ede3": des.EDE,
                                "des-ede-cbc": des.CBC.instantiate(des.EDE),
                                "des-ede": des.EDE,
                                "des-cbc": des.CBC.instantiate(des.DES),
                                "des-ecb": des.DES
                            };
                        modes.des = modes["des-cbc"], modes.des3 = modes["des-ede3-cbc"], module.exports = DES, inherits(DES, CipherBase), DES.prototype._update = function (data) {
                            return Buffer.from(this._des.update(data))
                        }, DES.prototype._final = function () {
                            return Buffer.from(this._des.final())
                        }
                    }, {
                        "cipher-base": 80,
                        "des.js": 93,
                        inherits: 147,
                        "safe-buffer": 235
                    }],
                    62: [function (require, module, exports) {
                        exports["des-ecb"] = {
                            key: 8,
                            iv: 0
                        }, exports["des-cbc"] = exports.des = {
                            key: 8,
                            iv: 8
                        }, exports["des-ede3-cbc"] = exports.des3 = {
                            key: 24,
                            iv: 8
                        }, exports["des-ede3"] = {
                            key: 24,
                            iv: 0
                        }, exports["des-ede-cbc"] = {
                            key: 16,
                            iv: 8
                        }, exports["des-ede"] = {
                            key: 16,
                            iv: 0
                        }
                    }, {}],
                    63: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function blind(priv) {
                                    var r = getr(priv),
                                        blinder = r.toRed(BN.mont(priv.modulus)).redPow(new BN(priv.publicExponent)).fromRed();
                                    return {
                                        blinder: blinder,
                                        unblinder: r.invm(priv.modulus)
                                    }
                                }

                                function getr(priv) {
                                    var len = priv.modulus.byteLength(),
                                        r;
                                    do r = new BN(randomBytes(len)); while (0 <= r.cmp(priv.modulus) || !r.umod(priv.prime1) || !r.umod(priv.prime2));
                                    return r
                                }

                                function crt(msg, priv) {
                                    var blinds = blind(priv),
                                        len = priv.modulus.byteLength(),
                                        blinded = new BN(msg).mul(blinds.blinder).umod(priv.modulus),
                                        c1 = blinded.toRed(BN.mont(priv.prime1)),
                                        c2 = blinded.toRed(BN.mont(priv.prime2)),
                                        qinv = priv.coefficient,
                                        p = priv.prime1,
                                        q = priv.prime2,
                                        m1 = c1.redPow(priv.exponent1).fromRed(),
                                        m2 = c2.redPow(priv.exponent2).fromRed(),
                                        h = m1.isub(m2).imul(qinv).umod(p).imul(q);
                                    return m2.iadd(h).imul(blinds.unblinder).umod(priv.modulus).toArrayLike(Buffer, "be", len)
                                }
                                var BN = require("bn.js"),
                                    randomBytes = require("randombytes");
                                crt.getr = getr, module.exports = crt
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        "bn.js": 40,
                        buffer: 76,
                        randombytes: 209
                    }],
                    64: [function (require, module, exports) {
                        module.exports = require("./browser/algorithms.json")
                    }, {
                        "./browser/algorithms.json": 65
                    }],
                    65: [function (require, module, exports) {
                        module.exports = {
                            sha224WithRSAEncryption: {
                                sign: "rsa",
                                hash: "sha224",
                                id: "302d300d06096086480165030402040500041c"
                            },
                            "RSA-SHA224": {
                                sign: "ecdsa/rsa",
                                hash: "sha224",
                                id: "302d300d06096086480165030402040500041c"
                            },
                            sha256WithRSAEncryption: {
                                sign: "rsa",
                                hash: "sha256",
                                id: "3031300d060960864801650304020105000420"
                            },
                            "RSA-SHA256": {
                                sign: "ecdsa/rsa",
                                hash: "sha256",
                                id: "3031300d060960864801650304020105000420"
                            },
                            sha384WithRSAEncryption: {
                                sign: "rsa",
                                hash: "sha384",
                                id: "3041300d060960864801650304020205000430"
                            },
                            "RSA-SHA384": {
                                sign: "ecdsa/rsa",
                                hash: "sha384",
                                id: "3041300d060960864801650304020205000430"
                            },
                            sha512WithRSAEncryption: {
                                sign: "rsa",
                                hash: "sha512",
                                id: "3051300d060960864801650304020305000440"
                            },
                            "RSA-SHA512": {
                                sign: "ecdsa/rsa",
                                hash: "sha512",
                                id: "3051300d060960864801650304020305000440"
                            },
                            "RSA-SHA1": {
                                sign: "rsa",
                                hash: "sha1",
                                id: "3021300906052b0e03021a05000414"
                            },
                            "ecdsa-with-SHA1": {
                                sign: "ecdsa",
                                hash: "sha1",
                                id: ""
                            },
                            sha256: {
                                sign: "ecdsa",
                                hash: "sha256",
                                id: ""
                            },
                            sha224: {
                                sign: "ecdsa",
                                hash: "sha224",
                                id: ""
                            },
                            sha384: {
                                sign: "ecdsa",
                                hash: "sha384",
                                id: ""
                            },
                            sha512: {
                                sign: "ecdsa",
                                hash: "sha512",
                                id: ""
                            },
                            "DSA-SHA": {
                                sign: "dsa",
                                hash: "sha1",
                                id: ""
                            },
                            "DSA-SHA1": {
                                sign: "dsa",
                                hash: "sha1",
                                id: ""
                            },
                            DSA: {
                                sign: "dsa",
                                hash: "sha1",
                                id: ""
                            },
                            "DSA-WITH-SHA224": {
                                sign: "dsa",
                                hash: "sha224",
                                id: ""
                            },
                            "DSA-SHA224": {
                                sign: "dsa",
                                hash: "sha224",
                                id: ""
                            },
                            "DSA-WITH-SHA256": {
                                sign: "dsa",
                                hash: "sha256",
                                id: ""
                            },
                            "DSA-SHA256": {
                                sign: "dsa",
                                hash: "sha256",
                                id: ""
                            },
                            "DSA-WITH-SHA384": {
                                sign: "dsa",
                                hash: "sha384",
                                id: ""
                            },
                            "DSA-SHA384": {
                                sign: "dsa",
                                hash: "sha384",
                                id: ""
                            },
                            "DSA-WITH-SHA512": {
                                sign: "dsa",
                                hash: "sha512",
                                id: ""
                            },
                            "DSA-SHA512": {
                                sign: "dsa",
                                hash: "sha512",
                                id: ""
                            },
                            "DSA-RIPEMD160": {
                                sign: "dsa",
                                hash: "rmd160",
                                id: ""
                            },
                            ripemd160WithRSA: {
                                sign: "rsa",
                                hash: "rmd160",
                                id: "3021300906052b2403020105000414"
                            },
                            "RSA-RIPEMD160": {
                                sign: "rsa",
                                hash: "rmd160",
                                id: "3021300906052b2403020105000414"
                            },
                            md5WithRSAEncryption: {
                                sign: "rsa",
                                hash: "md5",
                                id: "3020300c06082a864886f70d020505000410"
                            },
                            "RSA-MD5": {
                                sign: "rsa",
                                hash: "md5",
                                id: "3020300c06082a864886f70d020505000410"
                            }
                        }
                    }, {}],
                    66: [function (require, module, exports) {
                        module.exports = {
                            "1.3.132.0.10": "secp256k1",
                            "1.3.132.0.33": "p224",
                            "1.2.840.10045.3.1.1": "p192",
                            "1.2.840.10045.3.1.7": "p256",
                            "1.3.132.0.34": "p384",
                            "1.3.132.0.35": "p521"
                        }
                    }, {}],
                    67: [function (require, module, exports) {
                        function Sign(algorithm) {
                            stream.Writable.call(this);
                            var data = algorithms[algorithm];
                            if (!data) throw new Error("Unknown message digest");
                            this._hashType = data.hash, this._hash = createHash(data.hash), this._tag = data.id, this._signType = data.sign
                        }

                        function Verify(algorithm) {
                            stream.Writable.call(this);
                            var data = algorithms[algorithm];
                            if (!data) throw new Error("Unknown message digest");
                            this._hash = createHash(data.hash), this._tag = data.id, this._signType = data.sign
                        }

                        function createSign(algorithm) {
                            return new Sign(algorithm)
                        }

                        function createVerify(algorithm) {
                            return new Verify(algorithm)
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            createHash = require("create-hash"),
                            stream = require("readable-stream"),
                            inherits = require("inherits"),
                            sign = require("./sign"),
                            verify = require("./verify"),
                            algorithms = require("./algorithms.json");
                        Object.keys(algorithms).forEach(function (key) {
                            algorithms[key].id = Buffer.from(algorithms[key].id, "hex"), algorithms[key.toLowerCase()] = algorithms[key]
                        }), inherits(Sign, stream.Writable), Sign.prototype._write = function _write(data, _, done) {
                            this._hash.update(data), done()
                        }, Sign.prototype.update = function update(data, enc) {
                            return "string" == typeof data && (data = Buffer.from(data, enc)), this._hash.update(data), this
                        }, Sign.prototype.sign = function signMethod(key, enc) {
                            this.end();
                            var hash = this._hash.digest(),
                                sig = sign(hash, key, this._hashType, this._signType, this._tag);
                            return enc ? sig.toString(enc) : sig
                        }, inherits(Verify, stream.Writable), Verify.prototype._write = function _write(data, _, done) {
                            this._hash.update(data), done()
                        }, Verify.prototype.update = function update(data, enc) {
                            return "string" == typeof data && (data = Buffer.from(data, enc)), this._hash.update(data), this
                        }, Verify.prototype.verify = function verifyMethod(key, sig, enc) {
                            "string" == typeof sig && (sig = Buffer.from(sig, enc)), this.end();
                            var hash = this._hash.digest();
                            return verify(sig, hash, key, this._signType, this._tag)
                        }, module.exports = {
                            Sign: createSign,
                            Verify: createVerify,
                            createSign: createSign,
                            createVerify: createVerify
                        }
                    }, {
                        "./algorithms.json": 65,
                        "./sign": 68,
                        "./verify": 69,
                        "create-hash": 85,
                        inherits: 147,
                        "readable-stream": 228,
                        "safe-buffer": 235
                    }],
                    68: [function (require, module, exports) {
                        function sign(hash, key, hashType, signType, tag) {
                            var priv = parseKeys(key);
                            if (priv.curve) {
                                if ("ecdsa" !== signType && "ecdsa/rsa" !== signType) throw new Error("wrong private key type");
                                return ecSign(hash, priv)
                            }
                            if ("dsa" === priv.type) {
                                if ("dsa" !== signType) throw new Error("wrong private key type");
                                return dsaSign(hash, priv, hashType)
                            }
                            if ("rsa" !== signType && "ecdsa/rsa" !== signType) throw new Error("wrong private key type");
                            hash = Buffer.concat([tag, hash]);
                            for (var len = priv.modulus.byteLength(), pad = [0, 1]; hash.length + pad.length + 1 < len;) pad.push(255);
                            pad.push(0);
                            for (var i = -1; ++i < hash.length;) pad.push(hash[i]);
                            var out = crt(pad, priv);
                            return out
                        }

                        function ecSign(hash, priv) {
                            var curveId = curves[priv.curve.join(".")];
                            if (!curveId) throw new Error("unknown curve " + priv.curve.join("."));
                            var curve = new EC(curveId),
                                key = curve.keyFromPrivate(priv.privateKey),
                                out = key.sign(hash);
                            return Buffer.from(out.toDER())
                        }

                        function dsaSign(hash, priv, algo) {
                            for (var x = priv.params.priv_key, p = priv.params.p, q = priv.params.q, g = priv.params.g, r = new BN(0), H = bits2int(hash, q).mod(q), s = !1, kv = getKey(x, q, hash, algo), k; !1 === s;) k = makeKey(q, kv, algo), r = makeR(g, k, p, q), s = k.invm(q).imul(H.add(x.mul(r))).mod(q), 0 === s.cmpn(0) && (s = !1, r = new BN(0));
                            return toDER(r, s)
                        }

                        function toDER(r, s) {
                            r = r.toArray(), s = s.toArray(), 128 & r[0] && (r = [0].concat(r)), 128 & s[0] && (s = [0].concat(s));
                            var total = r.length + s.length + 4,
                                res = [48, total, 2, r.length];
                            return res = res.concat(r, [2, s.length], s), Buffer.from(res)
                        }

                        function getKey(x, q, hash, algo) {
                            if (x = Buffer.from(x.toArray()), x.length < q.byteLength()) {
                                var zeros = Buffer.alloc(q.byteLength() - x.length);
                                x = Buffer.concat([zeros, x])
                            }
                            var hlen = hash.length,
                                hbits = bits2octets(hash, q),
                                v = Buffer.alloc(hlen);
                            v.fill(1);
                            var k = Buffer.alloc(hlen);
                            return k = createHmac(algo, k).update(v).update(Buffer.from([0])).update(x).update(hbits).digest(), v = createHmac(algo, k).update(v).digest(), k = createHmac(algo, k).update(v).update(Buffer.from([1])).update(x).update(hbits).digest(), v = createHmac(algo, k).update(v).digest(), {
                                k: k,
                                v: v
                            }
                        }

                        function bits2int(obits, q) {
                            var bits = new BN(obits),
                                shift = (obits.length << 3) - q.bitLength();
                            return 0 < shift && bits.ishrn(shift), bits
                        }

                        function bits2octets(bits, q) {
                            bits = bits2int(bits, q), bits = bits.mod(q);
                            var out = Buffer.from(bits.toArray());
                            if (out.length < q.byteLength()) {
                                var zeros = Buffer.alloc(q.byteLength() - out.length);
                                out = Buffer.concat([zeros, out])
                            }
                            return out
                        }

                        function makeKey(q, kv, algo) {
                            var t, k;
                            do {
                                for (t = Buffer.alloc(0); 8 * t.length < q.bitLength();) kv.v = createHmac(algo, kv.k).update(kv.v).digest(), t = Buffer.concat([t, kv.v]);
                                k = bits2int(t, q), kv.k = createHmac(algo, kv.k).update(kv.v).update(Buffer.from([0])).digest(), kv.v = createHmac(algo, kv.k).update(kv.v).digest()
                            } while (-1 !== k.cmp(q));
                            return k
                        }

                        function makeR(g, k, p, q) {
                            return g.toRed(BN.mont(p)).redPow(k).fromRed().mod(q)
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            createHmac = require("create-hmac"),
                            crt = require("browserify-rsa"),
                            EC = require("elliptic").ec,
                            BN = require("bn.js"),
                            parseKeys = require("parse-asn1"),
                            curves = require("./curves.json");
                        module.exports = sign, module.exports.getKey = getKey, module.exports.makeKey = makeKey
                    }, {
                        "./curves.json": 66,
                        "bn.js": 40,
                        "browserify-rsa": 63,
                        "create-hmac": 87,
                        elliptic: 104,
                        "parse-asn1": 183,
                        "safe-buffer": 235
                    }],
                    69: [function (require, module, exports) {
                        function verify(sig, hash, key, signType, tag) {
                            var pub = parseKeys(key);
                            if ("ec" === pub.type) {
                                if ("ecdsa" !== signType && "ecdsa/rsa" !== signType) throw new Error("wrong public key type");
                                return ecVerify(sig, hash, pub)
                            }
                            if ("dsa" === pub.type) {
                                if ("dsa" !== signType) throw new Error("wrong public key type");
                                return dsaVerify(sig, hash, pub)
                            }
                            if ("rsa" !== signType && "ecdsa/rsa" !== signType) throw new Error("wrong public key type");
                            hash = Buffer.concat([tag, hash]);
                            for (var len = pub.modulus.byteLength(), pad = [1], padNum = 0; hash.length + pad.length + 2 < len;) pad.push(255), padNum++;
                            pad.push(0);
                            for (var i = -1; ++i < hash.length;) pad.push(hash[i]);
                            pad = Buffer.from(pad);
                            var red = BN.mont(pub.modulus);
                            sig = new BN(sig).toRed(red), sig = sig.redPow(new BN(pub.publicExponent)), sig = Buffer.from(sig.fromRed().toArray());
                            var out = 8 > padNum ? 1 : 0;
                            for (len = _Mathmin(sig.length, pad.length), sig.length !== pad.length && (out = 1), i = -1; ++i < len;) out |= sig[i] ^ pad[i];
                            return 0 == out
                        }

                        function ecVerify(sig, hash, pub) {
                            var curveId = curves[pub.data.algorithm.curve.join(".")];
                            if (!curveId) throw new Error("unknown curve " + pub.data.algorithm.curve.join("."));
                            var curve = new EC(curveId),
                                pubkey = pub.data.subjectPrivateKey.data;
                            return curve.verify(hash, sig, pubkey)
                        }

                        function dsaVerify(sig, hash, pub) {
                            var p = pub.data.p,
                                q = pub.data.q,
                                g = pub.data.g,
                                y = pub.data.pub_key,
                                unpacked = parseKeys.signature.decode(sig, "der"),
                                s = unpacked.s,
                                r = unpacked.r;
                            checkValue(s, q), checkValue(r, q);
                            var montp = BN.mont(p),
                                w = s.invm(q),
                                v = g.toRed(montp).redPow(new BN(hash).mul(w).mod(q)).fromRed().mul(y.toRed(montp).redPow(r.mul(w).mod(q)).fromRed()).mod(p).mod(q);
                            return 0 === v.cmp(r)
                        }

                        function checkValue(b, q) {
                            if (0 >= b.cmpn(0)) throw new Error("invalid sig");
                            if (b.cmp(q) >= q) throw new Error("invalid sig")
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            BN = require("bn.js"),
                            EC = require("elliptic").ec,
                            parseKeys = require("parse-asn1"),
                            curves = require("./curves.json");
                        module.exports = verify
                    }, {
                        "./curves.json": 66,
                        "bn.js": 40,
                        elliptic: 104,
                        "parse-asn1": 183,
                        "safe-buffer": 235
                    }],
                    70: [function (require, module, exports) {
                        function copyProps(src, dst) {
                            for (var key in src) dst[key] = src[key]
                        }

                        function SafeBuffer(arg, encodingOrOffset, length) {
                            return Buffer(arg, encodingOrOffset, length)
                        }
                        var buffer = require("buffer"),
                            Buffer = buffer.Buffer;
                        Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow ? module.exports = buffer : (copyProps(buffer, exports), exports.Buffer = SafeBuffer), copyProps(Buffer, SafeBuffer), SafeBuffer.from = function (arg, encodingOrOffset, length) {
                            if ("number" == typeof arg) throw new TypeError("Argument must not be a number");
                            return Buffer(arg, encodingOrOffset, length)
                        }, SafeBuffer.alloc = function (size, fill, encoding) {
                            if ("number" != typeof size) throw new TypeError("Argument must be a number");
                            var buf = Buffer(size);
                            return void 0 === fill ? buf.fill(0) : "string" == typeof encoding ? buf.fill(fill, encoding) : buf.fill(fill), buf
                        }, SafeBuffer.allocUnsafe = function (size) {
                            if ("number" != typeof size) throw new TypeError("Argument must be a number");
                            return Buffer(size)
                        }, SafeBuffer.allocUnsafeSlow = function (size) {
                            if ("number" != typeof size) throw new TypeError("Argument must be a number");
                            return buffer.SlowBuffer(size)
                        }
                    }, {
                        buffer: 76
                    }],
                    71: [function (require, module, exports) {
                        "use strict";

                        function _normalizeEncoding(enc) {
                            if (!enc) return "utf8";
                            for (var retried; !0;) switch (enc) {
                                case "utf8":
                                case "utf-8":
                                    return "utf8";
                                case "ucs2":
                                case "ucs-2":
                                case "utf16le":
                                case "utf-16le":
                                    return "utf16le";
                                case "latin1":
                                case "binary":
                                    return "latin1";
                                case "base64":
                                case "ascii":
                                case "hex":
                                    return enc;
                                default:
                                    if (retried) return;
                                    enc = ("" + enc).toLowerCase(), retried = !0;
                            }
                        }

                        function normalizeEncoding(enc) {
                            var nenc = _normalizeEncoding(enc);
                            if ("string" != typeof nenc && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
                            return nenc || enc
                        }

                        function StringDecoder(encoding) {
                            this.encoding = normalizeEncoding(encoding);
                            var nb;
                            switch (this.encoding) {
                                case "utf16le":
                                    this.text = utf16Text, this.end = utf16End, nb = 4;
                                    break;
                                case "utf8":
                                    this.fillLast = utf8FillLast, nb = 4;
                                    break;
                                case "base64":
                                    this.text = base64Text, this.end = base64End, nb = 3;
                                    break;
                                default:
                                    return this.write = simpleWrite, void(this.end = simpleEnd);
                            }
                            this.lastNeed = 0, this.lastTotal = 0, this.lastChar = Buffer.allocUnsafe(nb)
                        }

                        function utf8CheckByte(byte) {
                            if (127 >= byte) return 0;
                            return 6 == byte >> 5 ? 2 : 14 == byte >> 4 ? 3 : 30 == byte >> 3 ? 4 : 2 == byte >> 6 ? -1 : -2
                        }

                        function utf8CheckIncomplete(self, buf, i) {
                            var j = buf.length - 1;
                            if (j < i) return 0;
                            var nb = utf8CheckByte(buf[j]);
                            return 0 <= nb ? (0 < nb && (self.lastNeed = nb - 1), nb) : --j < i || -2 === nb ? 0 : (nb = utf8CheckByte(buf[j]), 0 <= nb) ? (0 < nb && (self.lastNeed = nb - 2), nb) : --j < i || -2 === nb ? 0 : (nb = utf8CheckByte(buf[j]), 0 <= nb ? (0 < nb && (2 === nb ? nb = 0 : self.lastNeed = nb - 3), nb) : 0)
                        }

                        function utf8CheckExtraBytes(self, buf, p) {
                            if (128 != (192 & buf[0])) return self.lastNeed = 0, "\uFFFD";
                            if (1 < self.lastNeed && 1 < buf.length) {
                                if (128 != (192 & buf[1])) return self.lastNeed = 1, "\uFFFD";
                                if (2 < self.lastNeed && 2 < buf.length && 128 != (192 & buf[2])) return self.lastNeed = 2, "\uFFFD"
                            }
                        }

                        function utf8FillLast(buf) {
                            var p = this.lastTotal - this.lastNeed,
                                r = utf8CheckExtraBytes(this, buf, p);
                            return void 0 === r ? this.lastNeed <= buf.length ? (buf.copy(this.lastChar, p, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal)) : void(buf.copy(this.lastChar, p, 0, buf.length), this.lastNeed -= buf.length) : r
                        }

                        function utf8Text(buf, i) {
                            var total = utf8CheckIncomplete(this, buf, i);
                            if (!this.lastNeed) return buf.toString("utf8", i);
                            this.lastTotal = total;
                            var end = buf.length - (total - this.lastNeed);
                            return buf.copy(this.lastChar, 0, end), buf.toString("utf8", i, end)
                        }

                        function utf8End(buf) {
                            var r = buf && buf.length ? this.write(buf) : "";
                            return this.lastNeed ? r + "\uFFFD" : r
                        }

                        function utf16Text(buf, i) {
                            if (0 == (buf.length - i) % 2) {
                                var r = buf.toString("utf16le", i);
                                if (r) {
                                    var c = r.charCodeAt(r.length - 1);
                                    if (55296 <= c && 56319 >= c) return this.lastNeed = 2, this.lastTotal = 4, this.lastChar[0] = buf[buf.length - 2], this.lastChar[1] = buf[buf.length - 1], r.slice(0, -1)
                                }
                                return r
                            }
                            return this.lastNeed = 1, this.lastTotal = 2, this.lastChar[0] = buf[buf.length - 1], buf.toString("utf16le", i, buf.length - 1)
                        }

                        function utf16End(buf) {
                            var r = buf && buf.length ? this.write(buf) : "";
                            if (this.lastNeed) {
                                var end = this.lastTotal - this.lastNeed;
                                return r + this.lastChar.toString("utf16le", 0, end)
                            }
                            return r
                        }

                        function base64Text(buf, i) {
                            var n = (buf.length - i) % 3;
                            return 0 == n ? buf.toString("base64", i) : (this.lastNeed = 3 - n, this.lastTotal = 3, 1 == n ? this.lastChar[0] = buf[buf.length - 1] : (this.lastChar[0] = buf[buf.length - 2], this.lastChar[1] = buf[buf.length - 1]), buf.toString("base64", i, buf.length - n))
                        }

                        function base64End(buf) {
                            var r = buf && buf.length ? this.write(buf) : "";
                            return this.lastNeed ? r + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : r
                        }

                        function simpleWrite(buf) {
                            return buf.toString(this.encoding)
                        }

                        function simpleEnd(buf) {
                            return buf && buf.length ? this.write(buf) : ""
                        }
                        var Buffer = require("safe-buffer").Buffer,
                            isEncoding = Buffer.isEncoding || function (encoding) {
                                switch (encoding = "" + encoding, encoding && encoding.toLowerCase()) {
                                    case "hex":
                                    case "utf8":
                                    case "utf-8":
                                    case "ascii":
                                    case "binary":
                                    case "base64":
                                    case "ucs2":
                                    case "ucs-2":
                                    case "utf16le":
                                    case "utf-16le":
                                    case "raw":
                                        return !0;
                                    default:
                                        return !1;
                                }
                            };
                        exports.StringDecoder = StringDecoder, StringDecoder.prototype.write = function (buf) {
                            if (0 === buf.length) return "";
                            var r, i;
                            if (this.lastNeed) {
                                if (r = this.fillLast(buf), void 0 === r) return "";
                                i = this.lastNeed, this.lastNeed = 0
                            } else i = 0;
                            return i < buf.length ? r ? r + this.text(buf, i) : this.text(buf, i) : r || ""
                        }, StringDecoder.prototype.end = utf8End, StringDecoder.prototype.text = utf8Text, StringDecoder.prototype.fillLast = function (buf) {
                            return this.lastNeed <= buf.length ? (buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal)) : void(buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length), this.lastNeed -= buf.length)
                        }
                    }, {
                        "safe-buffer": 70
                    }],
                    72: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function allocUnsafe(size) {
                                    if ("number" != typeof size) throw new TypeError("\"size\" argument must be a number");
                                    if (0 > size) throw new RangeError("\"size\" argument must not be negative");
                                    return Buffer.allocUnsafe ? Buffer.allocUnsafe(size) : new Buffer(size)
                                }
                                module.exports = allocUnsafe
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76
                    }],
                    73: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                var bufferFill = require("buffer-fill"),
                                    allocUnsafe = require("buffer-alloc-unsafe");
                                module.exports = function alloc(size, fill, encoding) {
                                    if ("number" != typeof size) throw new TypeError("\"size\" argument must be a number");
                                    if (0 > size) throw new RangeError("\"size\" argument must not be negative");
                                    if (Buffer.alloc) return Buffer.alloc(size, fill, encoding);
                                    var buffer = allocUnsafe(size);
                                    return 0 === size ? buffer : void 0 === fill ? bufferFill(buffer, 0) : ("string" != typeof encoding && (encoding = void 0), bufferFill(buffer, fill, encoding))
                                }
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76,
                        "buffer-alloc-unsafe": 72,
                        "buffer-fill": 74
                    }],
                    74: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                function isSingleByte(val) {
                                    return 1 === val.length && 256 > val.charCodeAt(0)
                                }

                                function fillWithNumber(buffer, val, start, end) {
                                    if (0 > start || end > buffer.length) throw new RangeError("Out of range index");
                                    return start >>>= 0, end = void 0 === end ? buffer.length : end >>> 0, end > start && buffer.fill(val, start, end), buffer
                                }

                                function fillWithBuffer(buffer, val, start, end) {
                                    if (0 > start || end > buffer.length) throw new RangeError("Out of range index");
                                    if (end <= start) return buffer;
                                    start >>>= 0, end = void 0 === end ? buffer.length : end >>> 0;
                                    for (var pos = start, len = val.length; pos <= end - len;) val.copy(buffer, pos), pos += len;
                                    return pos !== end && val.copy(buffer, pos, 0, end - pos), buffer
                                }

                                function fill(buffer, val, start, end, encoding) {
                                    if (hasFullSupport) return buffer.fill(val, start, end, encoding);
                                    if ("number" == typeof val) return fillWithNumber(buffer, val, start, end);
                                    if ("string" == typeof val) {
                                        if ("string" == typeof start ? (encoding = start, start = 0, end = buffer.length) : "string" == typeof end && (encoding = end, end = buffer.length), void 0 !== encoding && "string" != typeof encoding) throw new TypeError("encoding must be a string");
                                        if ("latin1" === encoding && (encoding = "binary"), "string" == typeof encoding && !Buffer.isEncoding(encoding)) throw new TypeError("Unknown encoding: " + encoding);
                                        if ("" === val) return fillWithNumber(buffer, 0, start, end);
                                        if (isSingleByte(val)) return fillWithNumber(buffer, val.charCodeAt(0), start, end);
                                        val = new Buffer(val, encoding)
                                    }
                                    return Buffer.isBuffer(val) ? fillWithBuffer(buffer, val, start, end) : fillWithNumber(buffer, 0, start, end)
                                }
                                var hasFullSupport = function () {
                                    try {
                                        if (!Buffer.isEncoding("latin1")) return !1;
                                        var buf = Buffer.alloc ? Buffer.alloc(4) : new Buffer(4);
                                        return buf.fill("ab", "ucs2"), "61006200" === buf.toString("hex")
                                    } catch (_) {
                                        return !1
                                    }
                                }();
                                module.exports = fill
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76
                    }],
                    75: [function (require, module, exports) {
                        (function (Buffer) {
                            (function () {
                                module.exports = function xor(a, b) {
                                    for (var length = _Mathmin(a.length, b.length), buffer = new Buffer(length), i = 0; i < length; ++i) buffer[i] = a[i] ^ b[i];
                                    return buffer
                                }
                            }).call(this)
                        }).call(this, require("buffer").Buffer)
                    }, {
                        buffer: 76
                    }],
                    76: [function (require, module, exports) {
                                (function (Buffer) {
                                        (function () {
                                                /*!