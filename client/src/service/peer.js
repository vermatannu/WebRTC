class PeerService {
  constructor() {
    this.createPeer();
  }

  createPeer() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ],
        },
      ],
    });

    this.pendingCandidates = [];
  }

  // Close current connection and create a fresh one
  close() {
    if (this.peer) {
      this.peer.close();
    }

    this.createPeer();
  }

  // Replace camera video track with screen video track
  async replaceVideoTrack(newTrack) {
    const videoSender = this.peer
      .getSenders()
      .find((sender) => sender.track?.kind === "video");

    if (!videoSender) {
      throw new Error("Video sender not found");
    }

    await videoSender.replaceTrack(newTrack);
  }

  // Candidates can arrive before remote description is set.
  // Queue them until it is, then add them.
  async addCandidate(candidate) {
    if (this.peer.remoteDescription) {
      await this.peer.addIceCandidate(candidate);
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  async flushCandidates() {
    for (const c of this.pendingCandidates) {
      try {
        await this.peer.addIceCandidate(c);
      } catch (err) {
        console.error("addIceCandidate (queued) failed", err);
      }
    }

    this.pendingCandidates = [];
  }

  async getOffer() {
    const offer = await this.peer.createOffer();

    await this.peer.setLocalDescription(offer);

    return offer;
  }

  // stream is optional:
  // tracks are added after remote offer is applied
  // and before answer is created
  async getAnswer(offer, stream) {
    await this.peer.setRemoteDescription(offer);

    await this.flushCandidates();

    if (stream) {
      stream.getTracks().forEach((track) => {
        this.peer.addTrack(track, stream);
      });
    }

    const answer = await this.peer.createAnswer();

    await this.peer.setLocalDescription(answer);

    return answer;
  }

  async setRemoteAnswer(ans) {
    if (this.peer.signalingState === "have-local-offer") {
      await this.peer.setRemoteDescription(ans);

      await this.flushCandidates();
    }
  }
}

export default new PeerService();
