import io, { Socket as SocketValue } from 'socket.io-client';
import { hostEvent, Room, Message } from "./types";

type Socket = typeof SocketValue;

export interface User {
  nickname: string;
  id: string;
}

export default class WEBRTC {
  private user: User | null = null;
  private p2p: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  private _streams: Array<MediaStream> = [];
  private _rooms: Array<Room> = [];
  private _users: Array<User> = [];

  private _connectionEstablished: boolean = false;
  private roomId: string = "";
  private socket: Socket;
  constructor(userName: string) {
    this.socket = io.connect(`${window.location.hostname}:3000`);
    this.initSocket(userName);

    this.createP2P();
  }

  public get streams() {
    return [this.localStream, ...this._streams];
  }

  public get room() {
    return this.roomId;
  }

  public get roomEntered() {
    return this.roomId !== "";
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
      //console.log("connection state:", this.p2p.connectionState);
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
      if (data.succes) {
        onCreationCb(data.roomId);
        this.host(data.roomId);
      }
    });
    this.fetchRooms();
  }

  async joinByName(roomName: string) {
    this.socket.emit("webrtc-roomJoinByNameQuery", { roomName });
    this.socket.on("webrtc-roomJoinByNameResponse", async (data) => {
      await this.join(data.roomId);
    })
  }

  async makeCall(): Promise<void> {
    if (this.p2p === null) throw `P2P is null!`;
    console.log("making call...");
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    this.localStream.getTracks().forEach(track => {
      this.p2p.addTrack(track, this.localStream);
    });
    //Not finished
    this.p2p.ontrack = (e: RTCTrackEvent) => {
      const currentStream: MediaStream = e.streams[0];
      const haveStream: boolean = Boolean(this._streams.find(
        (el: MediaStream) => el.id === currentStream.id
      ));
      if (!haveStream) {
        this._streams.push(currentStream);
      }
    }
  }


  async join(roomId: string) {
    this.setCndExhanger(roomId);
    this.socket.emit("webrtc-roomJoinQuery", { roomId });
    this.socket.on("webrtc-roomJoinResponse", async (data) => {
      if (data.succes) {
        await this.makeCall();
      }
    });
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
      await this.makeCall();
      const offer = await this.p2p.createOffer();
      console.log("offer", offer)
      await this.p2p.setLocalDescription(offer);
      this.socket.emit("webrtc-offer", {
        webRtcData: offer,
        roomId
      });
      this.socket.on("webrtc-answer", async ({ webRtcData }) => {
        //if (this.p2p.remoteDescription !== null) return;
        await this.p2p.setRemoteDescription(webRtcData);
      });
    });
  }
}
