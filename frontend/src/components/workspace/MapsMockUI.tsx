import React, { useState, useEffect } from 'react';
import { Search, Coffee, Briefcase, Home, CheckCircle, Navigation, X, Plus, Edit3, Trash2, CloudSun, Loader2, Route as RouteIcon, MapPin, Flag } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon (Leaflet + Vite issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImY2NDZiMDY3ZTY4NzQyZWFiYjcxYjU5YmY3N2ZmMTJjIiwiaCI6Im11cm11cjY0In0=';

type Place = { name: string; lat: number; lng: number; desc?: string };

const ICON_MAP: Record<string, React.FC<any>> = { Home, 'Office HQ': Briefcase, 'Coffee Shop': Coffee };

const loadSavedPlaces = (): Place[] => {
  try {
    const raw = localStorage.getItem('nexus_saved_places');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    { name: 'Home', lat: 28.6139, lng: 77.2090, desc: 'New Delhi, India' },
    { name: 'Office HQ', lat: 19.0760, lng: 72.8777, desc: 'Mumbai, India' },
    { name: 'Coffee Shop', lat: 12.9716, lng: 77.5946, desc: 'Bengaluru, India' },
  ];
};

const savePlaces = (places: Place[]) => {
  localStorage.setItem('nexus_saved_places', JSON.stringify(places));
};

// Sub-component: flies to a given position when it changes
const FlyTo: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

export const MapsMockUI: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [center, setCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [zoom, setZoom] = useState(5);
  const [marker, setMarker] = useState<Place | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'active' | 'denied'>('idle');

  const [savedPlaces, setSavedPlaces] = useState<Place[]>(loadSavedPlaces);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddr, setEditAddr] = useState('');
  const [addMode, setAddMode] = useState(false);

  // Mini weather badge
  const [miniWeather, setMiniWeather] = useState<{ temp: number } | null>(null);

  // Routing state
  const [routeMode, setRouteMode] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeStartPos, setRouteStartPos] = useState<Place | null>(null);
  const [routeEndPos, setRouteEndPos] = useState<Place | null>(null);

  // Fetch mini weather using Open-Meteo (No API Key required)
  const fetchMiniWeather = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`);
      if (res.ok) {
        const d = await res.json();
        setMiniWeather({ temp: Math.round(d.current.temperature_2m) });
      }
    } catch {}
  };

  // Geo-locate user on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPos(coords);
          setCenter(coords);
          setZoom(13);
          setGpsStatus('active');
          setMarker({ name: 'You are here', lat: coords[0], lng: coords[1], desc: 'Your current location' });
          fetchMiniWeather(coords[0], coords[1]);
        },
        () => { setGpsStatus('denied'); fetchMiniWeather(20.5937, 78.9629); },
        { timeout: 6000 }
      );
    }
  }, []);

  const geocodePlace = async (query: string): Promise<Place | null> => {
    try {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      if (userPos) {
        url += `&lat=${userPos[0]}&lon=${userPos[1]}`;
      }
      const res = await fetch(url, { headers: { 'User-Agent': 'Vocalis-NexusAI/1.0' } });
      const data = await res.json();
      if (data && data.length > 0) {
        return { name: data[0].display_name.split(',')[0], lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), desc: data[0].display_name };
      }
    } catch {}
    return null;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchError('');
    setRouteCoords([]); // clear previous routes
    setRouteStartPos(null);
    setRouteEndPos(null);
    setRouteInfo(null);
    try {
      const place = await geocodePlace(q);
      if (!place) { setSearchError('No results found.'); return; }
      const coords: [number, number] = [place.lat, place.lng];
      setCenter(coords);
      setZoom(14);
      setMarker(place);
      setInputValue('');
      fetchMiniWeather(coords[0], coords[1]);
    } catch {
      setSearchError('Search failed. Check your internet.');
    } finally {
      setIsSearching(false);
    }
  };

  const resolveLocationInput = async (input: string): Promise<Place | null> => {
    const q = input.trim().toLowerCase();
    if (!q) return null;
    
    // Check "My Location"
    if (q === 'my location' || q === 'current location' || q === 'me') {
      if (userPos) return { name: 'My Location', lat: userPos[0], lng: userPos[1] };
    }
    
    // Check saved places (Home, Office, etc)
    const saved = savedPlaces.find(p => p.name.toLowerCase() === q);
    if (saved) return saved;

    // Fallback to geocoding
    return await geocodePlace(input);
  };

  const handleGetRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startInput.trim() || !endInput.trim()) return;
    setIsRouting(true);
    setSearchError('');
    setRouteCoords([]);
    setRouteInfo(null);
    setRouteStartPos(null);
    setRouteEndPos(null);
    setMarker(null); // clear search marker

    try {
      const startP = await resolveLocationInput(startInput);
      const endP = await resolveLocationInput(endInput);

      if (!startP) { setSearchError('Start location not found.'); setIsRouting(false); return; }
      if (!endP) { setSearchError('End location not found.'); setIsRouting(false); return; }

      setRouteStartPos(startP);
      setRouteEndPos(endP);

      // Fetch Route from ORS
      const res = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${startP.lng},${startP.lat}&end=${endP.lng},${endP.lat}`);
      const data = await res.json();
      
      if (data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
        setRouteCoords(coords);
        
        const props = data.features[0].properties.segments[0];
        setRouteInfo({ distance: props.distance, duration: props.duration });
        
        setCenter([startP.lat, startP.lng]);
        setZoom(12);
        fetchMiniWeather(startP.lat, startP.lng);
      } else {
        setSearchError('Could not calculate route.');
      }
    } catch {
      setSearchError('Route search failed.');
    } finally {
      setIsRouting(false);
    }
  };

  const flyTo = (place: Place) => {
    setRouteMode(false);
    setCenter([place.lat, place.lng]);
    setZoom(14);
    setMarker(place);
    setRouteCoords([]);
    fetchMiniWeather(place.lat, place.lng);
  };

  const saveEditedPlace = async (idx: number) => {
    if (!editAddr.trim()) return;
    try {
      const geo = await geocodePlace(editAddr);
      if (!geo) { alert('Address not found.'); return; }
      const updated = [...savedPlaces];
      updated[idx] = { name: editName || updated[idx].name, lat: geo.lat, lng: geo.lng, desc: geo.desc };
      setSavedPlaces(updated);
      savePlaces(updated);
      setEditingIdx(null);
      flyTo(updated[idx]);
    } catch { alert('Could not geocode that address.'); }
  };

  const addNewPlace = async () => {
    if (!editName.trim() || !editAddr.trim()) return;
    try {
      const geo = await geocodePlace(editAddr);
      if (!geo) { alert('Address not found.'); return; }
      const newPlace: Place = { name: editName, lat: geo.lat, lng: geo.lng, desc: geo.desc };
      const updated = [...savedPlaces, newPlace];
      setSavedPlaces(updated);
      savePlaces(updated);
      setAddMode(false);
      setEditName('');
      setEditAddr('');
      flyTo(newPlace);
    } catch { alert('Could not geocode that address.'); }
  };

  const deletePlace = (idx: number) => {
    const updated = savedPlaces.filter((_, i) => i !== idx);
    setSavedPlaces(updated);
    savePlaces(updated);
  };

  return (
    <div style={{
      minHeight: '500px', flex: 1,
      border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(20,22,27,0.2)',
      borderRadius: '16px', overflow: 'hidden', display: 'flex',
      fontFamily: 'sans-serif', color: '#fff', boxSizing: 'border-box'
    }}>
      {/* Left Sidebar */}
      <div style={{ width: '250px', backgroundColor: 'rgba(0,0,0,0.25)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box', gap: '16px', overflowY: 'auto' }}>
        
        {/* Toggle Route Mode */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRouteMode(false)} style={{ flex: 1, padding: '8px', background: !routeMode ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Search size={14} /> Search
          </button>
          <button onClick={() => setRouteMode(true)} style={{ flex: 1, padding: '8px', background: routeMode ? 'rgba(91,140,255,0.2)' : 'transparent', border: `1px solid ${routeMode ? '#5B8CFF' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: routeMode ? '#5B8CFF' : '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <RouteIcon size={14} /> Directions
          </button>
        </div>

        {/* Search / Route Form */}
        {!routeMode ? (
          <form onSubmit={handleSearch}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Search size={15} color="rgba(255,255,255,0.4)" style={{ marginRight: 8, flexShrink: 0 }} />
              <input type="text" placeholder="Search anywhere..." value={inputValue}
                onChange={e => { setInputValue(e.target.value); setSearchError(''); }}
                disabled={isSearching}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '13px' }} />
              {isSearching && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0, color: '#5B8CFF' }} />}
            </div>
            {searchError && <p style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6, marginBottom: 0 }}>{searchError}</p>}
          </form>
        ) : (
          <form onSubmit={handleGetRoute} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MapPin size={15} color="#5B8CFF" style={{ marginRight: 8, flexShrink: 0 }} />
              <input type="text" placeholder="Start location..." value={startInput}
                onChange={e => { setStartInput(e.target.value); setSearchError(''); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '13px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Flag size={15} color="#efa044" style={{ marginRight: 8, flexShrink: 0 }} />
              <input type="text" placeholder="Destination..." value={endInput}
                onChange={e => { setEndInput(e.target.value); setSearchError(''); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '13px' }} />
            </div>
            <button type="submit" disabled={isRouting} style={{ background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontWeight: 600, fontSize: 13, cursor: isRouting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {isRouting ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <RouteIcon size={14} />}
              Find Route
            </button>
            {searchError && <p style={{ fontSize: 11, color: '#ff6b6b', margin: 0 }}>{searchError}</p>}
            
            {routeInfo && (
              <div style={{ marginTop: 8, padding: 10, background: 'rgba(91,140,255,0.1)', borderRadius: 8, border: '1px solid rgba(91,140,255,0.2)', fontSize: 12, color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Distance:</span>
                  <strong>{(routeInfo.distance / 1000).toFixed(1)} km</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Est. Time:</span>
                  <strong>{Math.round(routeInfo.duration / 60)} mins</strong>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Saved Places */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Saved Places</h3>
            <button onClick={() => { setAddMode(true); setEditName(''); setEditAddr(''); }} style={{ background: 'none', border: 'none', color: '#5B8CFF', cursor: 'pointer', padding: 2, display: 'flex' }} title="Add place">
              <Plus size={14} />
            </button>
          </div>

          {/* Add new place form */}
          {addMode && (
            <div style={{ background: 'rgba(91,140,255,0.06)', border: '1px solid rgba(91,140,255,0.2)', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input type="text" placeholder="Place name..." value={editName} onChange={e => setEditName(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: '#fff', fontSize: 12, outline: 'none' }} />
              <input type="text" placeholder="Address or city..." value={editAddr} onChange={e => setEditAddr(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: '#fff', fontSize: 12, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addNewPlace} style={{ flex: 1, background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setAddMode(false)} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {savedPlaces.map((p, idx) => {
              const IconComp = ICON_MAP[p.name] || MapsMockIcon;
              if (editingIdx === idx) {
                return (
                  <div key={idx} style={{ background: 'rgba(91,140,255,0.06)', border: '1px solid rgba(91,140,255,0.2)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: '#fff', fontSize: 12, outline: 'none' }} />
                    <input type="text" placeholder="New address..." value={editAddr} onChange={e => setEditAddr(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: '#fff', fontSize: 12, outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => saveEditedPlace(idx)} style={{ flex: 1, background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingIdx(null)} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', padding: '7px 9px', borderRadius: 8, transition: 'background 0.15s', cursor: 'pointer' }}
                  onClick={() => flyTo(p)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ padding: '5px', backgroundColor: 'rgba(91,140,255,0.12)', borderRadius: '6px', display: 'flex', flexShrink: 0 }}>
                    <IconComp size={14} color="#5B8CFF" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditingIdx(idx); setEditName(p.name); setEditAddr(p.desc || ''); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2, display: 'flex' }} title="Edit">
                    <Edit3 size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deletePlace(idx); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', padding: 2, display: 'flex' }} title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Location */}
        {userPos && (
          <div>
            <h3 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)', marginBottom: '8px', marginTop: 0 }}>My Location</h3>
            <div onClick={() => { setCenter(userPos); setZoom(15); fetchMiniWeather(userPos[0], userPos[1]); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: '7px 9px', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ padding: '5px', backgroundColor: 'rgba(239,160,68,0.12)', borderRadius: '6px', display: 'flex' }}>
                <Navigation size={14} color="#efa044" />
              </div>
              Go to My Location
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* GPS Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600,
          color: gpsStatus === 'active' ? '#1DB954' : gpsStatus === 'denied' ? '#ff6b6b' : 'rgba(255,255,255,0.4)',
          padding: '8px', backgroundColor: gpsStatus === 'active' ? 'rgba(29,185,84,0.1)' : 'rgba(255,255,255,0.04)', borderRadius: '8px', justifyContent: 'center',
          border: `1px solid ${gpsStatus === 'active' ? 'rgba(29,185,84,0.2)' : 'rgba(255,255,255,0.06)'}`
        }}>
          {gpsStatus === 'active' ? <><CheckCircle size={14} /> GPS Active</> : gpsStatus === 'denied' ? <><X size={14} /> GPS Denied</> : <><Navigation size={14} /> Locating...</>}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={center} zoom={zoom} style={{ width: '100%', height: '100%' }} zoomControl={true} attributionControl={true}>
          <TileLayer url={DARK_TILE} attribution={DARK_TILE_ATTR} />
          <FlyTo center={center} zoom={zoom} />
          
          {/* Single Marker (Search mode) */}
          {!routeMode && marker && (
            <Marker position={[marker.lat, marker.lng]}>
              <Popup>
                <div style={{ minWidth: 140 }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>{marker.name}</strong>
                  {marker.desc && <span style={{ fontSize: 12, color: '#555' }}>{marker.desc}</span>}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Route Markers and Polyline (Route mode) */}
          {routeMode && routeCoords.length > 0 && (
            <>
              <Polyline positions={routeCoords} color="#5B8CFF" weight={4} opacity={0.8} />
              {routeStartPos && (
                <Marker position={[routeStartPos.lat, routeStartPos.lng]}>
                  <Popup><strong>Start:</strong> {routeStartPos.name}</Popup>
                </Marker>
              )}
              {routeEndPos && (
                <Marker position={[routeEndPos.lat, routeEndPos.lng]}>
                  <Popup><strong>End:</strong> {routeEndPos.name}</Popup>
                </Marker>
              )}
            </>
          )}
        </MapContainer>

        {/* Mini Weather Badge */}
        {miniWeather && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
            color: '#fff', fontSize: 13, fontWeight: 600
          }}>
            <CloudSun size={16} color="#efa044" />
            {miniWeather.temp}°C
          </div>
        )}
      </div>
    </div>
  );
};

// Fallback icon for custom saved places
const MapsMockIcon: React.FC<any> = (props) => <Navigation {...props} />;


