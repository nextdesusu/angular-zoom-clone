import io, { Socket as SocketValue } from 'socket.io-client';
import { hostEvent, Room, Message } from "./types";

type Socket = typeof SocketValue;

type cbType = (arg: any) => void;

export interface User {
  nickname: string;
  id: string;
}

export interface UserStream {
  user: User;
  stream: MediaStream;
}

interface messageToSend {
  text: string;
  date: Date;
  author: User;
}

export default class WEBRTC {
  private socket: Socket;
  private user: User | null;
  private channel: RTCDataChannel | null;
  private p2p: RTCPeerConnection | null;
  private _rooms: Array<Room>;
  private _users: Array<User>;
  private _connectionEstablished: boolean = false;
  private webrtcDataCb: cbType | null;
  private roomId: string = "";
  private streams: Array<UserStream>;
  constructor(userName: string) {
    this._rooms = [];
    this.user = null;
    this._users = [];
    this.channel = null;
    this.p2p = null;
    this.socket = io.connect(`${window.location.hostname}:3000`);
    this.initSocket(userName);
    this.streams = [];

    this.createP2P();
  }

  public get allStreams() {
    return this.streams;
  }

  setwebrtcDataCb(cb: cbType): void {
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

  private fetchRooms(): void {
    this.socket.emit("webrtc-roomsRequest");
  }

  private setCndExhanger(roomId: string) {
    this.roomId = roomId;
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

  get connectionEstablished() {
    return this._connectionEstablished;
  }

  createRoom(event: hostEvent, onCreationCb: (roomId: string) => void) {
    this.socket.emit("webrtc-roomHostQuery", { roomName: event.name });
    this.socket.on("webrtc-roomHostResponse", (data) => {
      onCreationCb(data.roomId);
      this.host(data.roomId);
    });
    this.fetchRooms();
  }

  async joinByName(roomName: string) {
    this.socket.emit("webrtc-roomJoinByNameQuery", { roomName });
    this.socket.on("webrtc-roomJoinByNameResponse", async (data) => {
      console.log("data", data);
      await this.join(data.roomId);
    })
  }

  async makeCall(): Promise<void> {
    if (this.p2p === null) {
      throw `P2P is null!`;
    }
    const localStream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    this.streams.push({
      user: this.user,
      stream: localStream,
    });
    localStream.getTracks().forEach(track => {
      this.p2p.addTrack(track, localStream);
    });
    let joinedId = 0;
    this.p2p.ontrack = (e) => {
      console.log("got track:", e);
      if (joinedId < 1) {
        this.streams.push({
          user: { nickname: "unknown", id: "undefined" },
          stream: e.streams[0]
        });
      }
      joinedId += 1;
    }
  }

  async join(roomId: string) {
    this.setCndExhanger(roomId);
    this.socket.emit("webrtc-roomJoinQuery", { roomId });
    await this.makeCall();
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
      console.log("client join!");
      await this.makeCall();
      const offer = await this.p2p.createOffer();
      await this.p2p.setLocalDescription(offer);
      this.socket.emit("webrtc-offer", {
        webRtcData: offer,
        roomId
      });
      this.socket.on("webrtc-answer", async ({ webRtcData }) => {
        await this.p2p.setRemoteDescription(webRtcData);
      });
    });
  }
  //await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  /*
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
  */
}
