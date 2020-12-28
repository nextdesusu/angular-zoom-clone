import io, { Socket as SocketValue } from 'socket.io-client';
import { hostEvent, Room, Message } from "./types";

type Socket = typeof SocketValue;

type cbType = (arg: any) => void;

export interface User {
  nickname: string;
  id: string;
}

interface messageToSend {
  text: string;
  date: Date;
  author: User;
}

export default class Connection {
  private socket: Socket;
  private user: User | null;
  private channel: RTCDataChannel | null;
  private p2p: RTCPeerConnection | null;
  private _rooms: Array<Room>;
  private _mesages: Array<Message>;
  private _connectionEstablished: boolean = false;
  private webrtcDataCb: cbType | null;
  constructor(userName: string) {
    this._rooms = [];
    this._mesages = [];
    this.user = null;
    this.channel = null;
    this.p2p = null;
    this.socket = io.connect(`${window.location.hostname}:3000`);
    this.initSocket(userName);

    this.createP2P();
    this.createDataChannel();
  }

  setwebrtcDataCb(cb: cbType) {
    this.webrtcDataCb = cb;
  }

  private initSocket(userName: string): void {
    this.socket.on("connect", () => {
      this.socket.emit("webrtc-userJoined", { nickname: userName });
    });
    this.socket.on("webrtc-userId", (data) => {
      this.user = {
        nickname: userName,
        id: data.id
      };
      this.fetchRooms();
    })
    const applyRooms = (data) => {
      console.log("applyRooms -> data:", data);
      this._rooms = data.rooms;
    }
    this.socket.on("webrtc-roomsRequestFullfilled", applyRooms);
    this.socket.on("webrtc-roomsUpdate", applyRooms);
  }

  private createP2P(): void {
    this.p2p = new RTCPeerConnection();
    this.p2p.onconnectionstatechange = () => {
      if (this.p2p.connectionState === "connected") {
        this._connectionEstablished = true;
      }
      console.log("connection state:", this.p2p.connectionState);
    }
  }

  private createDataChannel(): void {
    if (this.p2p === null) {
      throw `P2P is null!`;
    }
    this.channel = this.p2p.createDataChannel("webrtc", { negotiated: true, id: 0 });
    this.channel.onopen = () => {
      const stringified = JSON.stringify({ key: "p", data: this.user });
      this.channel.send(stringified);
    };
    this.channel.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg === null) return;
      const codeChar = msg.key;
      switch (codeChar) {
        case "m":
          this._mesages.push(msg);
          break;
        case "p":
          break;
        case "g":
          if (this.webrtcDataCb !== null) {
            this.webrtcDataCb(msg);
          }
          break;
        default:
          console.log(`unkown message type, message is: ${msg}`);
      }
    }
  }

  private fetchRooms(): void {
    this.socket.emit("webrtc-roomsRequest");
  }

  private setCndExhanger(roomId: string) {
    const candidates = [];
    this.p2p.onicecandidate = ({ candidate }) => {
      if (candidate !== null) {
        candidates.push(candidate);
      } else {
        this.socket.emit("ICE-exhangeCandidates", { candidates, roomId });
      }
    }
    this.socket.on("ICE-exhangeCandidates", (exchangedCandidates) => {
      for (const candidate of exchangedCandidates) {
        this.p2p.addIceCandidate(candidate);
      }
    });
  }

  get rooms() {
    return this._rooms;
  }

  get messages() {
    return this._mesages;
  }

  get connectionEstablished() {
    return this._connectionEstablished;
  }

  sendMessage(msgData: { text: string, date: Date }) {
    const msg: messageToSend = {
      ...msgData,
      author: this.user,
    };
    this._mesages.push(msg);
    const stringified = JSON.stringify({ key: "m", data: msg });
    this.channel.send(stringified);
  }

  sendwebrtcData(data: string): void {
    const stringified = JSON.stringify({ key: "g", data });
    this.channel.send(stringified);
  }

  createRoom(event: hostEvent, onCreationCb: (roomId: string) => void) {
    this.socket.emit("webrtc-roomHostQuery", { roomName: event.name, webrtcType: event.type });
    this.socket.on("webrtc-roomHostResponse", (data) => {
      onCreationCb(data.roomId);
    });
    this.fetchRooms();
  }

  async join(roomId: string) {
    this.setCndExhanger(roomId);
    this.socket.emit("webrtc-roomJoinQuery", { roomId });
    this.socket.on("webrtc-offer", async ({ webRtcData }) => {
      await this.p2p.setRemoteDescription(webRtcData);
      const answer = await this.p2p.createAnswer();
      await this.p2p.setLocalDescription(answer);
      this.socket.emit("webrtc-answer", {
        webRtcData: answer,
        roomId
      });
    });
  }

  async host(roomId: string) {
    this.setCndExhanger(roomId);
    this.socket.on("webrtc-clientJoin", async () => {
      const offer = await this.p2p.createOffer();
      await this.p2p.setLocalDescription(offer);
      this.socket.emit("webrtc-offer", {
        webRtcData: offer,
        roomId
      });
    });
    this.socket.on("webrtc-answer", async ({ webRtcData }) => {
      await this.p2p.setRemoteDescription(webRtcData);
    });
  }
}
