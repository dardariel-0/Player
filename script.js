const clientId = "b3291a18cc094504a0d0094f73e1215c";
const redirectUri = "https://player-daniel.netlify.app";
const playlist_uri = "3bM016MXIWljN8rQVtztBL";

const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "user-read-currently-playing",
];

function generateRandomString(length) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

document.getElementById("login-btn").onclick = async () => {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem("code_verifier", codeVerifier);

  const args = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  window.location = "https://accounts.spotify.com/authorize?" + args;
};

async function getAccessToken(code) {
  const codeVerifier = localStorage.getItem("code_verifier");

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body,
  });

  const data = await response.json();
  return data.access_token;
}

async function playMyPlaylist(access_token) {
  await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${window.device_id}`,
    {
      method: "PUT",
      body: JSON.stringify({ context_uri: playlist_uri }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    }
  );
}

function initializePlayer(token) {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "Meu Player",
      getOAuthToken: (cb) => {
        cb(token);
      },
      volume: 0.7,
    });

    player.connect();

    player.addListener("ready", async ({ device_id }) => {
      console.log("Player pronto! Device ID", device_id);
      window.device_id = device_id;
      document.getElementById("login-btn").style.display = "none";
      document.getElementById("player").style.display = "block";
      await playMyPlaylist(token); // TOCA A PLAYLIST AUTOMÁTICO
    });

    player.addListener("player_state_changed", (state) => {
      if (!state) return;
      const track = state.track_window.current_track;
      document.getElementById("album-cover").src =
        track.album.images[0]?.url || "";
      document.getElementById("track-name").textContent = track.name;
      document.getElementById("artist-name").textContent = track.artists
        .map((artist) => artist.name)
        .join(", ");
    });

    document.getElementById("play-btn").onclick = () => player.resume();
    document.getElementById("pause-btn").onclick = () => player.pause();
    document.getElementById("next-btn").onclick = () => player.nextTrack();
    document.getElementById("prev-btn").onclick = () => player.previousTrack();
    document.getElementById("volume").oninput = (e) =>
      player.setVolume(e.target.value);
  };
}

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const token = await getAccessToken(code);
    window.history.replaceState({}, document.title, "/");
    initializePlayer(token);
  }
}

handleRedirect();
