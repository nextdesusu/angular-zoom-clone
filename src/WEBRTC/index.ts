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

export default class WEBRTC {
  private socket: Socket;
  private user: User | null;
  private channel: RTCDataChannel | null;
  private p2p: RTCPeerConnection | null;
  private _rooms: Array<Room>;
  private _mesages: Array<Message>;
  private _connectionEstablished: boolean = false;
  private webrtcDataCb: cbType | null;
  private roomId: string = "";
  private videoElem: any;
  private cVideo: any;
  constructor(userName: string, videoElem: any, cVideo: any) {
    this._rooms = [];
    this._mesages = [];
    this.user = null;
    this.channel = null;
    this.p2p = null;
    this.socket = io.connect(`${window.location.hostname}:3000`);
    this.initSocket(userName);
    this.videoElem = videoElem;
    this.cVideo = cVideo;

    this.createP2P();
    //this.makeCall();
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
    }/*
    this.p2p.onnegotiationneeded = async () => {
      const offer = await this.p2p.createOffer();
      await this.p2p.setLocalDescription(offer);
      this.socket.emit("webrtc-offer", {
        webRtcData: offer,
        roomId: this.roomId
      });
      console.log("onnegotiationneeded to:", this.roomId);
    };*/
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

  get messages() {
    return this._mesages;
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
    //this.videoElem.srcObject = localStream;
    this.videoElem.srcObject = localStream;
    console.log("lstream", localStream);
    localStream.getTracks().forEach(track => {
      this.p2p.addTrack(track, localStream);
    });
    this.p2p.ontrack = (track) => console.log("got track:", track);
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
