import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import peer from "../service/peer";
import { useNavigate } from "react-router-dom";

function Room() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [remoteMuted, setRemoteMuted] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const screenStreamRef = useRef(null);

  const remoteIdRef = useRef(null);
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    remoteIdRef.current = id;
    setRemoteSocketId(id);
  }, []);

  // CALLER
  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    setMyStream(stream);

    stream.getTracks().forEach((t) => peer.peer.addTrack(t, stream));

    const offer = await peer.getOffer();

    socket.emit("user:call", {
      to: remoteSocketId,
      offer,
    });
  }, [remoteSocketId, socket]);

  const handleToggleCamera = useCallback(() => {
    if (!myStream) return;

    const videoTrack = myStream.getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;

    setIsCameraOff(!videoTrack.enabled);
  }, [myStream]);

  // CALLEE
  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      remoteIdRef.current = from;
      setRemoteSocketId(from);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      setMyStream(stream);

      const ans = await peer.getAnswer(offer, stream);

      socket.emit("call:accepted", {
        to: from,
        ans,
      });
    },
    [socket],
  );

  // CALLER receives answer
  const handleCallAccepted = useCallback(async ({ ans }) => {
    await peer.setRemoteAnswer(ans);
    console.log("Call Accepted");
  }, []);

  // Renegotiation
  const handleNegoNeeded = useCallback(async () => {
    if (!peer.peer.remoteDescription) return;
    if (peer.peer.signalingState !== "stable") return;

    const offer = await peer.getOffer();

    socket.emit("peer:nego:needed", {
      offer,
      to: remoteIdRef.current,
    });
  }, [socket]);

  const handleNegoNeedIncoming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);

      socket.emit("peer:nego:done", {
        to: from,
        ans,
      });
    },
    [socket],
  );

  const handleNegoFinal = useCallback(async ({ ans }) => {
    await peer.setRemoteAnswer(ans);
  }, []);

  const handleEndCall = useCallback(() => {
    // Notify the other participant
    if (remoteSocketId) {
      socket.emit("call:ended", {
        to: remoteSocketId,
      });
    }

    // Stop screen sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      screenStreamRef.current = null;
    }

    // Stop camera and microphone
    if (myStream) {
      myStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Close WebRTC connection
    peer.close();

    // Clear local state
    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);

    // Go back to lobby
    navigate("/");
  }, [remoteSocketId, socket, myStream, navigate]);

  // ICE
  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      await peer.addCandidate(candidate);
    } catch (err) {
      console.error("addIceCandidate failed", err);
    }
  }, []);

  // negotiationneeded
  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);

    return () =>
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
  }, [handleNegoNeeded]);

  // Remote tracks
  useEffect(() => {
    const onTrack = (ev) => {
      console.log("GOT TRACKS!!", ev.track.kind);
      setRemoteStream(ev.streams[0]);
    };

    peer.peer.addEventListener("track", onTrack);

    return () => peer.peer.removeEventListener("track", onTrack);
  }, []);

  // ICE
  useEffect(() => {
    const onIceCandidate = (e) => {
      if (e.candidate && remoteIdRef.current) {
        socket.emit("ice:candidate", {
          to: remoteIdRef.current,
          candidate: e.candidate,
        });
      }
    };

    const onIceState = () =>
      console.log("ICE state:", peer.peer.iceConnectionState);

    const onConnState = () =>
      console.log("Connection state:", peer.peer.connectionState);

    peer.peer.addEventListener("icecandidate", onIceCandidate);
    peer.peer.addEventListener("iceconnectionstatechange", onIceState);
    peer.peer.addEventListener("connectionstatechange", onConnState);

    return () => {
      peer.peer.removeEventListener("icecandidate", onIceCandidate);

      peer.peer.removeEventListener("iceconnectionstatechange", onIceState);

      peer.peer.removeEventListener("connectionstatechange", onConnState);
    };
  }, [socket]);

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
        return;
      }

      if (!myStream) {
        console.error("Camera stream is not available");
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];

      await peer.replaceVideoTrack(screenTrack);

      setIsScreenSharing(true);

      screenTrack.onended = async () => {
        await stopScreenShare();
      };
    } catch (error) {
      console.error("Screen sharing error:", error);
    }
  };

  const stopScreenShare = async () => {
    try {
      const cameraTrack = stream?.getVideoTracks()[0];

      if (cameraTrack) {
        await peer.replaceVideoTrack(cameraTrack);
      }

      screenStreamRef.current?.getTracks().forEach((track) => track.stop());

      screenStreamRef.current = null;

      setIsScreenSharing(false);
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const handleRemoteCallEnded = useCallback(() => {
    // Stop screen sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      screenStreamRef.current = null;
    }

    // Stop camera and microphone
    if (myStream) {
      myStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    peer.close();

    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);

    navigate("/");
  }, [myStream, navigate]);

  // Socket listeners
  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncoming);
    socket.on("peer:nego:final", handleNegoFinal);
    socket.on("ice:candidate", handleIceCandidate);
    socket.on("call:ended", handleRemoteCallEnded);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncoming);
      socket.off("peer:nego:final", handleNegoFinal);
      socket.off("ice:candidate", handleIceCandidate);
      socket.off("call:ended", handleRemoteCallEnded);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncomingCall,
    handleCallAccepted,
    handleNegoNeedIncoming,
    handleNegoFinal,
    handleIceCandidate,
    handleRemoteCallEnded,
  ]);

  // Attach local stream
  useEffect(() => {
    if (myVideoRef.current && myStream) {
      myVideoRef.current.srcObject = myStream;
    }
  }, [myStream]);

  // Attach remote stream
  useEffect(() => {
    const video = remoteVideoRef.current;

    if (video && remoteStream) {
      video.srcObject = remoteStream;

      video.play().catch((e) => console.warn("play blocked:", e));
    }
  }, [remoteStream]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-md">
              V
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-800">
                WebRTC Connect
              </h1>

              <p className="text-xs text-slate-500">
                Peer-to-peer video calling
              </p>
            </div>
          </div>

          {/* Connection status */}
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              remoteSocketId
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                remoteSocketId ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />

            {remoteSocketId ? "Connected" : "Waiting for participant"}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-blue-600">VIDEO ROOM</p>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Your video meeting room
          </h2>

          <p className="mt-2 max-w-2xl text-slate-500">
            Connect directly with another participant using real-time
            peer-to-peer communication.
          </p>
        </div>

        {/* Waiting state */}
        {!remoteSocketId && (
          <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl">
              📹
            </div>

            <h3 className="text-lg font-semibold text-slate-800">
              Waiting for someone to join
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Share your room with another participant to start a video call.
            </p>
          </div>
        )}

        {/* Video Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* My Video */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-800">You</h3>

                <p className="text-xs text-slate-500">Local camera</p>
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                {myStream ? "Live" : "Camera off"}
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden bg-slate-100">
              {/* Keep video mounted */}
              <video
                ref={myVideoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${
                  myStream && !isCameraOff ? "visible" : "invisible"
                }`}
              />

              {/* Camera off / not started placeholder */}
              {(!myStream || isCameraOff) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-2xl">
                      📷
                    </div>

                    <p className="text-sm text-slate-500">
                      {isCameraOff ? "Camera is off" : "Camera not started"}
                    </p>
                  </div>
                </div>
              )}

              {/* Local label */}
              {myStream && (
                <div className="absolute bottom-4 left-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                  You
                </div>
              )}
            </div>
          </div>

          {/* Remote Video */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-800">
                  Remote Participant
                </h3>

                <p className="text-xs text-slate-500">Peer camera</p>
              </div>

              {remoteStream && (
                <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live
                </div>
              )}
            </div>

            <div className="relative aspect-video bg-slate-100">
              {remoteStream ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={remoteMuted}
                    className="h-full w-full object-cover"
                  />

                  {remoteMuted && (
                    <button
                      onClick={() => setRemoteMuted(false)}
                      className="absolute bottom-4 right-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 cursor-pointer"
                    >
                      🔊 Unmute
                    </button>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-xl">
                      👤
                    </div>

                    <p className="text-sm text-slate-500">
                      Waiting for remote video...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        {/* Controls */}
        <div className="mt-8 flex justify-center">
          {/* Start Call */}
          {!myStream && remoteSocketId && (
            <button
              onClick={handleCallUser}
              className="group flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl cursor-pointer"
            >
              <span className="text-lg">📞</span>
              Start Video Call
            </button>
          )}

          {/* Active Call Controls */}
          {myStream && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Camera Off */}
              <button
                onClick={handleToggleCamera}
                disabled={!myStream}
                className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  isCameraOff
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {isCameraOff ? "📷 Camera On" : "📷 Camera Off"}
              </button>
              {/* Screen Share */}
              <button
                onClick={handleScreenShare}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 font-semibold shadow-sm transition cursor-pointer ${
                  isScreenSharing
                    ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>🖥️</span>
                {isScreenSharing ? "Stop Sharing" : "Share Screen"}
              </button>

              {/* End Call */}
              <button
                onClick={handleEndCall}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-red-600 cursor-pointer"
              >
                <span>📞</span>
                End Call
              </button>

              {/* Call Status */}
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-5 py-3 shadow-sm">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />

                <span className="text-sm font-medium text-slate-600">
                  Call in progress
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Technology cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              Connection
            </p>

            <h4 className="font-semibold text-slate-800">Peer-to-Peer</h4>

            <p className="mt-1 text-sm text-slate-500">
              Direct WebRTC communication between browsers.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Signaling
            </p>

            <h4 className="font-semibold text-slate-800">Socket.IO</h4>

            <p className="mt-1 text-sm text-slate-500">
              Real-time signaling for call negotiation.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Transport
            </p>

            <h4 className="font-semibold text-slate-800">WebRTC + ICE</h4>

            <p className="mt-1 text-sm text-slate-500">
              Secure real-time audio and video streaming.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Room;
