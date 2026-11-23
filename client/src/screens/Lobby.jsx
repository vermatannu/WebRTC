import React, { useCallback, useEffect, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

const LobbyScreen = () => {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    try {
      setCreatingRoom(true);

      const response = await fetch("http://localhost:8000/api/rooms", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setRoom(data.roomId);
      }
    } catch (error) {
      console.error("Error creating room:", error);
    } finally {
      setCreatingRoom(false);
    }
  };

  useEffect(() => {
  const params = new URLSearchParams(location.search);
  const roomFromLink = params.get("room");

  if (roomFromLink) {
    setRoom(roomFromLink);
  }
}, [location.search]);

 
const handleShareMeeting = async () => {
  const meetingLink = `${window.location.origin}/?room=${encodeURIComponent(room)}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Join my meeting",
        text: "Join me in this video meeting!",
        url: meetingLink,
      });
    } else {
      await navigator.clipboard.writeText(meetingLink);
      alert("Meeting link copied!");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error sharing meeting:", error);
    }
  }
};


  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!email.trim() || !room.trim()) {
        return;
      }

      console.log("Join button clicked");

      console.log("Sending:", {
        email,
        room,
      });

      socket.emit("room:join", {
        email,
        room,
      });
    },
    [email, room, socket],
  );

  const handleJoinRoom = useCallback(
    (data) => {
      const { room } = data;
      navigate(`/room/${room}`);
    },
    [navigate],
  );

  useEffect(() => {
    socket.on("room:join", handleJoinRoom);

    return () => {
      socket.off("room:join", handleJoinRoom);
    };
  }, [socket, handleJoinRoom]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-md"></div>

            <div>
              <h1 className="text-xl font-bold text-slate-800">
                WebRTC Connect
              </h1>

              <p className="text-xs text-slate-500">
                Peer-to-peer video calling
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex min-h-[calc(100vh-81px)] items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-2">
          {/* Left Side */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            {/* Decorative circles */}
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10" />

            <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-white/10" />

            <div className="relative z-10">
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">
                📹
              </div>

              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-100">
                Welcome
              </p>

              <h2 className="text-4xl font-bold leading-tight">
                Connect.
                <br />
                Talk.
                <br />
                Share.
              </h2>

              <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100">
                Start a real-time video conversation using peer-to-peer WebRTC
                technology.
              </p>
            </div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-3 text-sm text-blue-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  ✓
                </span>
                Real-time video & audio
              </div>

              <div className="flex items-center gap-3 text-sm text-blue-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  ✓
                </span>
                Peer-to-peer communication
              </div>

              <div className="flex items-center gap-3 text-sm text-blue-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  ✓
                </span>
                Secure WebRTC connection
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="p-8 sm:p-10 lg:p-12">
            <div className="mb-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl">
                👋
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                Join a meeting
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your details below to join a video room.
              </p>

              {/* Create Room Button */}
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={creatingRoom}
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
              >
                {creatingRoom ? "Creating Room..." : "+ Create New Room"}
              </button>

              {room && (
                <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Your Meeting Room ID
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-bold tracking-wider text-indigo-700">
                      {room}
                    </span>

                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(room)}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-600 shadow-sm"
                    >
                      Copy ID
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleShareMeeting}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    🔗 Share Meeting Link
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    ✉
                  </span>

                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Room */}
              <div>
                <label
                  htmlFor="room"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Room ID
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    #
                  </span>

                  <input
                    type="text"
                    id="room"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Enter room number"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  Ask the host for the room ID to join their call.
                </p>
              </div>

              {/* Join button */}
              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl cursor-pointer"
              >
                Join Meeting
                <span className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </button>
            </form>

            {/* Bottom info */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              WebRTC powered real-time communication
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LobbyScreen;
