const clientId = "b3291a18cc094504a0d0094f73e1215c";
const redirectUri = "https://player-daniel.netlify.app";
const playlistId = "3bM016MXIWljN8rQVtztBL";

const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "user-read-currently-playing",
];

function getAccessTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("access_token");
}

function redirectToSpotifyLogin() {
  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes.join(" "))}`;
  window.location.href = authUrl;
}

document.getElementById("login-btn").onclick = () => {
  redirectToSpotifyLogin();
};

let playerGlobal;
let trackDuration = 0;

function setupSpotifyPlayer(access_token) {
  if (window.Spotify) {
    initializePlayer(access_token);
  } else {
    window.onSpotifyWebPlaybackSDKReady = () => initializePlayer(access_token);
  }
}

function initializePlayer(access_token) {
  const player = new Spotify.Player({
    name: "Meu Web Player Avançado",
    getOAuthToken: (cb) => {
      cb(access_token);
    },
    volume: 0.7,
  });

  player.connect();

  player.addListener("ready", ({ device_id }) => {
    console.log("Player pronto! Device ID", device_id);
    window.device_id = device_id;
    document.getElementById("login-btn").style.display = "none";
    document.getElementById("player").style.display = "block";
    fetchCurrentlyPlaying(access_token);
  });

  player.addListener("player_state_changed", (state) => {
    if (!state) return;
    const current_track = state.track_window.current_track;
    updateTrackInfo(current_track);
    updateProgress(state);
  });

  document.getElementById("play-btn").onclick = () => player.resume();
  document.getElementById("pause-btn").onclick = () => player.pause();
  document.getElementById("next-btn").onclick = () => player.nextTrack();
  document.getElementById("prev-btn").onclick = () => player.previousTrack();
  document.getElementById("play-playlist-btn").onclick = () =>
    playPlaylist(access_token);
  document.getElementById("volume").oninput = (e) =>
    player.setVolume(e.target.value);

  playerGlobal = player;

  // Atualizar progresso a cada 1s
  setInterval(() => {
    if (playerGlobal) {
      playerGlobal.getCurrentState().then((state) => {
        if (state) {
          updateProgress(state);
        }
      });
    }
  }, 1000);
}

function updateTrackInfo(track) {
  if (!track) return;
  document.getElementById("album-cover").src = track.album.images[0].url;
  document.getElementById("track-name").textContent = track.name;
  document.getElementById("artist-name").textContent = track.artists
    .map((a) => a.name)
    .join(", ");
  trackDuration = track.duration_ms;
  document.getElementById("progress").max = trackDuration;
  document.getElementById("duration").textContent = formatTime(
    track.duration_ms
  );
}

function updateProgress(state) {
  const position = state.position;
  document.getElementById("progress").value = position;
  document.getElementById("current-time").textContent = formatTime(position);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function fetchCurrentlyPlaying(access_token) {
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );
  if (res.ok) {
    const data = await res.json();
    updateTrackInfo(data.item);
  }
}

async function playPlaylist(access_token) {
  const url = `https://api.spotify.com/v1/me/player/play?device_id=${window.device_id}`;
  await fetch(url, {
    method: "PUT",
    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
  });
}

const access_token = getAccessTokenFromUrl();
if (access_token) {
  window.history.pushState("", document.title, redirectUri);
  setupSpotifyPlayer(access_token);
}
