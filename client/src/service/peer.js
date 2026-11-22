class PeerService {
  constructor() {
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

  // Candidates can arrive before the remote description is set.
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

  // stream is optional: on the first call, tracks are added AFTER the
  // remote offer is applied and BEFORE the answer is created
  async getAnswer(offer, stream) {
    await this.peer.setRemoteDescription(offer);
    await this.flushCandidates();
    if (stream) {
      stream.getTracks().forEach((t) => this.peer.addTrack(t, stream));
    }
    const ans = await this.peer.createAnswer();
    await this.peer.setLocalDescription(ans);
    return ans;
  }

  async setRemoteAnswer(ans) {
    if (this.peer.signalingState === "have-local-offer") {
      await this.peer.setRemoteDescription(ans);
      await this.flushCandidates();
    }
  }
}

export default new PeerService();