import React, { useState, useEffect } from 'react';
import { Globe, LogIn, Search, Plus, Loader2, Music, X, UserCheck, UserPlus, ChevronLeft } from 'lucide-react';
import { redirectToSpotifyLogin } from '../../lib/spotify';
import { useAgentStore } from '../../stores/agentStore';

type EmbedType = 'playlist' | 'track' | 'album' | 'artist';
type SidebarTab = 'library' | 'artists';
type ArtistView = null | { id: string; name: string; image: string };

async function spotifyFetch(url: string, token: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
  });
  return res;
}

export const MusicPlayerUI: React.FC = () => {
  const { spotifyToken, setSpotifyToken } = useAgentStore();
  const token = spotifyToken;
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [followedArtists, setFollowedArtists] = useState<any[]>([]);

  const [activeType, setActiveType] = useState<EmbedType>('playlist');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [apiRestricted, setApiRestricted] = useState(false);

  const [tab, setTab] = useState<SidebarTab>('library');
  const [artistView, setArtistView] = useState<ArtistView>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState<any[]>([]);
  const [isArtistSearching, setIsArtistSearching] = useState(false);

  const [manualUrl, setManualUrl] = useState('');

  useEffect(() => {
    if (token) {
      fetchAll(token);
    } else {
      // Clear state when token is removed
      setActiveId(null);
      setSearchResults([]);
      setUserPlaylists([]);
      setUserProfile(null);
      setFollowedArtists([]);
    }
  }, [token]);

  const fetchAll = async (tk: string) => {
    setLoading(true);
    setInitError(null);
    try {
      const meRes = await spotifyFetch('https://api.spotify.com/v1/me', tk);
      if (meRes.status === 401) {
        setSpotifyToken(null);
        return;
      }
      
      const plRes = await spotifyFetch('https://api.spotify.com/v1/me/playlists?limit=50', tk);
      const artRes = await spotifyFetch('https://api.spotify.com/v1/me/following?type=artist&limit=50', tk);

      const readRes = async (r: Response) => {
        const text = await r.text();
        try { return JSON.parse(text); } catch { return { _raw: text, status: r.status }; }
      };

      const me = await readRes(meRes);
      const pl = await readRes(plRes);
      const artRaw = await readRes(artRes);
      
      setUserProfile(me);

      const playlists = pl.items ? pl.items.filter(Boolean) : [];
      setUserPlaylists(playlists);

      // artRaw may be a 403 error if the token is missing user-follow-read scope
      const artists = artRaw?.artists?.items ? artRaw.artists.items.filter(Boolean) : [];
      setFollowedArtists(artists);
      const fm: Record<string, boolean> = {};
      artists.forEach((a: any) => { fm[a.id] = true; });
      setFollowingMap(fm);

      // If following endpoint returned error, warn in console
      if (artRaw?.error) {
        console.warn('Followed artists fetch failed:', artRaw.error.message);
      }
      
      const checkPremiumError = (errObj: any) => {
        const msg = errObj?.error?.message || errObj?._raw || '';
        return msg.toLowerCase().includes('premium subscription required');
      };

      if (checkPremiumError(me) || checkPremiumError(pl)) {
        setApiRestricted(true);
        setActiveId('37i9dQZEVXbMDoHDwVN2tF'); // Global Top 50
        setActiveType('playlist');
        setLoading(false);
        return;
      }

      if (me?.error || me?._raw) {
        setInitError(`Profile Error (Status ${meRes.status}): ${me?.error?.message || me?._raw || 'Unknown 403 error. Check Spotify Developer Dashboard user allowlist.'}`);
      } else if (pl?.error || pl?._raw) {
        setInitError(`Playlists Error (Status ${plRes.status}): ${pl?.error?.message || pl?._raw || 'Unknown error'}`);
      }

      if (playlists.length > 0) { setActiveId(playlists[0].id); setActiveType('playlist'); }
      else { setActiveId('37i9dQZEVXbMDoHDwVN2tF'); setActiveType('playlist'); }
    } catch (e: any) {
      console.error('Spotify fetch error:', e);
      setInitError(`Network Error: ${e?.message || 'Unknown error occurred while connecting to Spotify.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || !token) return;
    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const res = await spotifyFetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track,playlist&limit=8&market=from_token`,
        token
      );
      if (!res.ok) {
        const text = await res.text();
        let errObj: any = {};
        try { errObj = JSON.parse(text); } catch {}
        setSearchError(errObj?.error?.message || `Error ${res.status}: ${text || 'Unknown API Error'}`);
        return;
      }
      const data = await res.json();
      const results: any[] = [];
      (data.tracks?.items || []).filter(Boolean).forEach((t: any) => results.push({ ...t, _type: 'track' }));
      (data.playlists?.items || []).filter(Boolean).forEach((p: any) => results.push({ ...p, _type: 'playlist' }));
      if (results.length === 0) setSearchError(`No results for "${q}"`);
      else setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Search failed. Check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleArtistSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = artistSearchQuery.trim();
    if (!q || !token) return;
    setIsArtistSearching(true);
    setArtistSearchResults([]);
    try {
      const res = await spotifyFetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=6`,
        token
      );
      const data = await res.json();
      setArtistSearchResults((data.artists?.items || []).filter(Boolean));
    } catch { /* silent */ }
    finally { setIsArtistSearching(false); }
  };

  const handleFollowToggle = async (artistId: string) => {
    if (!token || followLoading) return;
    setFollowLoading(artistId);
    const isFollowing = followingMap[artistId];
    try {
      const res = await spotifyFetch(
        `https://api.spotify.com/v1/me/following?type=artist&ids=${artistId}`,
        token,
        { method: isFollowing ? 'DELETE' : 'PUT' }
      );
      if (!res.ok) {
        const errText = await res.text();
        let msg = res.status.toString();
        try {
          const errObj = JSON.parse(errText);
          if (errObj.error?.message) msg = errObj.error.message;
        } catch { /* ignore */ }
        console.error('Failed to follow/unfollow:', errText);
        alert(`Spotify API Error: ${msg}\n\nDid you forget to check all the permission boxes on the Spotify Login screen?`);
        return;
      }
      setFollowingMap(prev => ({ ...prev, [artistId]: !isFollowing }));
      if (!isFollowing) {
        // Add to followed list
        const artistRes = await spotifyFetch(`https://api.spotify.com/v1/artists/${artistId}`, token);
        const artist = await artistRes.json();
        setFollowedArtists(prev => [artist, ...prev.filter((a: any) => a.id !== artistId)]);
      } else {
        setFollowedArtists(prev => prev.filter((a: any) => a.id !== artistId));
      }
    } catch (e: any) { alert(`Follow error: ${e.message}`); }
    finally { setFollowLoading(null); }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name || !userProfile || !token) return;
    setIsCreating(true);
    setCreateMsg(null);
    try {
      const res = await spotifyFetch(`https://api.spotify.com/v1/users/${userProfile.id}/playlists`, token, {
        method: 'POST',
        body: JSON.stringify({ name, description: 'Created from Nexus AI ✨', public: false }),
      });
      if (!res.ok) {
        let errStr = `Error ${res.status}`;
        try {
          const errObj = await res.json();
          if (errObj.error?.message) errStr = errObj.error.message;
        } catch { /* ignore */ }
        setCreateMsg({ text: `Failed: ${errStr}. (Check Spotify Developer App settings)`, ok: false });
        return;
      }
      const np = await res.json();
      if (np.id) {
        setUserPlaylists(prev => [np, ...prev]);
        setActiveId(np.id); setActiveType('playlist');
        setNewPlaylistName('');
        setCreateMsg({ text: `"${name}" created in Spotify!`, ok: true });
        setTimeout(() => setCreateMsg(null), 3000);
      } else {
        setCreateMsg({ text: np?.error?.message || 'Failed to create.', ok: false });
      }
    } catch { setCreateMsg({ text: 'Network error. Try again.', ok: false }); }
    finally { setIsCreating(false); }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ minHeight: 500, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 0 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 28px rgba(29,185,84,0.4)' }}>
          <Music size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Connect to Spotify</h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 28, textAlign: 'center', maxWidth: 360, lineHeight: 1.65, fontSize: 14 }}>
          Browse playlists, followed artists, search songs, create playlists — all without leaving NexusAI.
        </p>
        <button onClick={() => redirectToSpotifyLogin()} style={{ background: '#1DB954', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: 30, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 16px rgba(29,185,84,0.35)' }}>
          <LogIn size={18} /> Login with Spotify
        </button>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 620, display: 'flex', background: 'rgba(14,16,21,0.6)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', color: '#fff' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 288, minWidth: 288, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,12,17,0.5)', overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {(['library', 'artists'] as SidebarTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setArtistView(null); }}
              style={{ flex: 1, padding: '13px 0', background: 'none', border: 'none', color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', borderBottom: `2px solid ${tab === t ? '#5B8CFF' : 'transparent'}`, transition: 'all 0.2s' }}>
              {t === 'library' ? 'Library' : 'Artists'}
            </button>
          ))}
        </div>

        {/* ── LIBRARY TAB ── */}
        {tab === 'library' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Search */}
            <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 7 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={13} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="text" placeholder="Search Spotify..." value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) { setSearchResults([]); setSearchError(''); } }}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px 8px 28px', color: '#fff', outline: 'none', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={isSearching || !searchQuery.trim()}
                  style={{ background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12, opacity: isSearching || !searchQuery.trim() ? 0.6 : 1, minWidth: 38 }}>
                  {isSearching ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Go'}
                </button>
              </form>
              {searchError && <p style={{ fontSize: 11, color: '#ff6b6b', margin: '6px 2px 0', lineHeight: 1.4 }}>{searchError}</p>}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
              {searchResults.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>Results</span>
                    <button onClick={() => { setSearchResults([]); setSearchQuery(''); setSearchError(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><X size={11} /> Clear</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {searchResults.map((item, idx) => {
                      const img = item.album?.images?.[0]?.url || item.images?.[0]?.url;
                      const sub = item._type === 'track' ? item.artists?.map((a: any) => a.name).join(', ') : 'Playlist';
                      return (
                        <div key={`${item.id}-${idx}`} onClick={() => { setActiveId(item.id); setActiveType(item._type); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', background: activeId === item.id ? 'rgba(91,140,255,0.15)' : 'transparent', transition: 'background 0.15s' }}>
                          {img ? <img src={img} alt="" style={{ width: 36, height: 36, borderRadius: item._type === 'track' ? 4 : 4, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 4, background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color="rgba(255,255,255,0.3)" /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your Playlists</div>
                  {userPlaylists.length === 0 && !loading && !apiRestricted && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>No playlists yet.</p>}
                  {apiRestricted && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Playlist management disabled.</p>}
                  {!apiRestricted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
                      {userPlaylists.map(pl => (
                        <div key={pl.id} onClick={() => { setActiveId(pl.id); setActiveType('playlist'); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', background: activeId === pl.id ? 'rgba(91,140,255,0.15)' : 'transparent', transition: 'background 0.15s' }}>
                          {pl.images?.[0]?.url ? <img src={pl.images[0].url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(91,140,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={13} color="#5B8CFF" /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{pl.tracks?.total ?? 0} tracks</div>
                          </div>
                        </div>
                      ))}
                      {/* Create Playlist */}
                      <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', borderRadius: 7, border: '1px dashed rgba(29,185,84,0.35)', background: 'rgba(29,185,84,0.05)', marginTop: 4 }}>
                        <Plus size={13} color="#1DB954" style={{ flexShrink: 0 }} />
                        <input type="text" placeholder="New playlist name..." value={newPlaylistName}
                          onChange={e => { setNewPlaylistName(e.target.value); setCreateMsg(null); }}
                          style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: 12, outline: 'none', minWidth: 0 }} />
                        {newPlaylistName.trim() && (
                          <button type="submit" disabled={isCreating} style={{ background: '#1DB954', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: isCreating ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                            {isCreating ? '…' : 'Create'}
                          </button>
                        )}
                      </form>
                      {createMsg && <p style={{ fontSize: 11, color: createMsg.ok ? '#1DB954' : '#ff6b6b', marginTop: 4, paddingLeft: 2 }}>{createMsg.ok ? '✓ ' : '✗ '}{createMsg.text}</p>}
                    </div>
                  )}

                  {/* Discover */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Discover</div>
                  <div onClick={() => { setActiveId('37i9dQZEVXbMDoHDwVN2tF'); setActiveType('playlist'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', background: activeId === '37i9dQZEVXbMDoHDwVN2tF' ? 'rgba(91,140,255,0.15)' : 'transparent', transition: 'background 0.15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: 'linear-gradient(135deg,#1DB954,#0a5c2a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Globe size={15} color="#fff" /></div>
                    <div><div style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>Global Top 50</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Daily chart</div></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ARTISTS TAB ── */}
        {tab === 'artists' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {artistView ? (
              /* Artist Detail */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <button onClick={() => setArtistView(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', padding: '12px 14px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                  <ChevronLeft size={14} /> Back to Artists
                </button>
                <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                  <img src={artistView.image} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{artistView.name}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button onClick={() => { setActiveId(artistView.id); setActiveType('artist'); }}
                        style={{ background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Discography
                      </button>
                      {!apiRestricted && (
                        <button onClick={() => handleFollowToggle(artistView.id)} disabled={followLoading === artistView.id}
                          style={{ background: followingMap[artistView.id] ? 'rgba(255,255,255,0.08)' : 'rgba(29,185,84,0.2)', color: followingMap[artistView.id] ? 'rgba(255,255,255,0.6)' : '#1DB954', border: `1px solid ${followingMap[artistView.id] ? 'rgba(255,255,255,0.12)' : 'rgba(29,185,84,0.4)'}`, borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: followLoading === artistView.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {followLoading === artistView.id ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : followingMap[artistView.id] ? <><UserCheck size={11} /> Following</> : <><UserPlus size={11} /> Follow</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', flex: 1, overflow: 'auto' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    Click <strong style={{ color: '#5B8CFF' }}>Discography</strong> to load this artist's full catalog in the player.
                  </p>
                </div>
              </div>
            ) : (
              /* Artist List */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>
                  <form onSubmit={handleArtistSearch} style={{ display: 'flex', gap: 7 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={13} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input type="text" placeholder="Find artists..." value={artistSearchQuery}
                        onChange={e => { setArtistSearchQuery(e.target.value); if (!e.target.value) setArtistSearchResults([]); }}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px 8px 28px', color: '#fff', outline: 'none', fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <button type="submit" disabled={isArtistSearching || !artistSearchQuery.trim() || apiRestricted}
                      style={{ background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: isArtistSearching || !artistSearchQuery.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12, opacity: isArtistSearching || !artistSearchQuery.trim() ? 0.6 : 1, minWidth: 38 }}>
                      {isArtistSearching ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Find'}
                    </button>
                  </form>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
                  {/* Search results */}
                  {artistSearchResults.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>Search Results</span>
                        <button onClick={() => { setArtistSearchResults([]); setArtistSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><X size={11} /> Clear</button>
                      </div>
                      {artistSearchResults.map(artist => (
                        <div key={artist.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, background: 'rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                          onClick={() => setArtistView({ id: artist.id, name: artist.name, image: artist.images?.[0]?.url || '' })}>
                          {artist.images?.[0]?.url ? <img src={artist.images[0].url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color="rgba(255,255,255,0.3)" /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{artist.followers?.total?.toLocaleString()} followers</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Followed Artists */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Following ({followedArtists.length})
                  </div>
                  {followedArtists.length === 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Not following any artists yet.</p>}
                  {followedArtists.map(artist => (
                    <div key={artist.id} onClick={() => setArtistView({ id: artist.id, name: artist.name, image: artist.images?.[0]?.url || '' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, background: activeId === artist.id ? 'rgba(91,140,255,0.15)' : 'transparent', transition: 'background 0.15s' }}>
                      {artist.images?.[0]?.url ? <img src={artist.images[0].url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={13} color="rgba(255,255,255,0.3)" /></div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{artist.genres?.[0] || 'Artist'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {userProfile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
              {userProfile.images?.[0]?.url
                ? <img src={userProfile.images[0].url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{userProfile.display_name?.[0] ?? 'S'}</div>}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile.display_name}</span>
            </div>
          )}
          {/* Connected badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 12px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.25)', borderRadius: 8 }}>
            <Globe size={13} color="#1DB954" />
            <span style={{ fontSize: 12, color: '#1DB954', fontWeight: 600 }}>Connected to Spotify</span>
          </div>
          <button onClick={() => setSpotifyToken(null)}
            style={{ width: '100%', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}>
            Disconnect
          </button>
        </div>
      </div>

      {/* ── Spotify Embed ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 20 }}>
        {apiRestricted && (
          <div style={{ background: 'rgba(239, 160, 68, 0.1)', border: '1px solid rgba(239, 160, 68, 0.25)', color: '#efa044', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Spotify's servers are syncing your Premium status...</strong>
            Since you just purchased Premium, it can take Spotify a few hours to sync your new status to their Developer API. 
            While we wait for them to unlock your library, you can manually play any playlist or song right now by pasting its Spotify link below!
            
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input 
                type="text" 
                placeholder="Paste Spotify Link (e.g. https://open.spotify.com/playlist/...)"
                value={manualUrl}
                onChange={e => setManualUrl(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239,160,68,0.4)', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 12, outline: 'none' }}
              />
              <button 
                onClick={() => {
                  if (!manualUrl) return;
                  const match = manualUrl.match(/spotify\.com\/(playlist|track|album|artist)\/([a-zA-Z0-9]+)/);
                  if (match) {
                    setActiveType(match[1] as EmbedType);
                    setActiveId(match[2]);
                    setManualUrl('');
                  } else {
                    alert('Invalid Spotify link. Please copy a link directly from the Spotify app.');
                  }
                }}
                style={{ background: '#efa044', color: '#000', border: 'none', borderRadius: 6, padding: '0 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Play Now
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', gap: 10 }}>
            <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading your music...
          </div>
        ) : initError ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', gap: 10, textAlign: 'center' }}>
            <div style={{ padding: '16px 24px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
              <strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>Failed to load Spotify data</strong>
              <p style={{ fontSize: 14, opacity: 0.9 }}>{initError}</p>
              <button onClick={() => fetchAll(token)} style={{ marginTop: 16, background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Try Again</button>
            </div>
          </div>
        ) : activeId ? (
          <iframe
            key={`${activeType}-${activeId}`}
            src={`https://open.spotify.com/embed/${activeType}/${activeId}?utm_source=generator&theme=0`}
            width="100%" height="100%"
            style={{ border: 'none', borderRadius: 12, minHeight: 480, display: 'block' }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            Select a playlist or search for music.
          </div>
        )}
      </div>
    </div>
  );
};
