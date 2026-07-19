'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Anchor, Plane, Loader2 } from 'lucide-react';
import { Place, PlaceType } from '@/lib/geo/places';
import { searchPlaces } from '@/lib/geo/nearest';

interface LocationSearchProps {
  placeholder?: string;
  value?: string;
  onSelect: (place: Place | { name: string, lat: number, lng: number }) => void;
}

export function LocationSearch({ placeholder = "Search location...", value = "", onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      // 1. Local Search
      const localResults = searchPlaces(query);
      
      // 2. Nominatim fallback if < 3 results
      if (localResults.length < 3) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          const nominatimResults = data.map((item: any) => ({
            id: `nom_${item.place_id}`,
            name: item.display_name,
            country: '', // Nominatim display_name usually includes country
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: 'city' as PlaceType,
            source: 'nominatim'
          }));
          
          // Combine, avoiding exact name duplicates
          const combined = [...localResults];
          nominatimResults.forEach((nr: any) => {
            if (!combined.some(lr => lr.name.toLowerCase() === nr.name.split(',')[0].toLowerCase())) {
              combined.push(nr);
            }
          });
          setResults(combined);
        } catch (e) {
          console.error("Nominatim search failed", e);
          setResults(localResults);
        }
      } else {
        setResults(localResults);
      }
      setLoading(false);
      setIsOpen(true);
    };

    const timeoutId = setTimeout(() => {
      fetchResults();
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (place: any) => {
    setQuery(place.name.split(',')[0]); // Just show the main name in the input
    setIsOpen(false);
    onSelect(place);
  };

  const getIcon = (type: string) => {
    if (type === 'port') return <Anchor className="w-4 h-4 text-blue-500" />;
    if (type === 'airport') return <Plane className="w-4 h-4 text-teal-500" />;
    return <MapPin className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div style={{ position: 'relative', width: '100%', fontFamily: 'var(--body)' }} ref={wrapperRef}>
      <div 
        style={{ 
          position: 'relative', 
          display: 'flex', 
          alignItems: 'center',
          background: '#fffefa',
          border: '1px solid var(--line)',
          borderRadius: '5px',
          padding: '0 10px',
          minHeight: '40px',
          transition: 'all 0.2s ease',
          cursor: 'text'
        }}
        onClick={() => {
          const input = wrapperRef.current?.querySelector('input');
          if (input) input.focus();
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--line)';
        }}
      >
        <Search style={{ width: '16px', height: '16px', color: 'var(--muted)', flexShrink: 0, marginRight: '8px' }} />
        <input
          type="text"
          style={{ 
            flex: 1,
            width: '100%', 
            border: 'none', 
            outline: 'none', 
            background: 'transparent', 
            fontSize: '12px',
            color: 'var(--ink)',
            padding: '4px 0'
          }}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => { if (query.length >= 2) setIsOpen(true) }}
        />
        {loading && <Loader2 style={{ width: '16px', height: '16px', color: 'var(--primary, #2d463e)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
      </div>

      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute',
          zIndex: 1000,
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '8px',
          background: 'var(--paper, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)',
          maxHeight: '320px',
          overflowY: 'auto',
          padding: '8px',
          display: 'grid',
          gap: '4px'
        }}>
          {results.map((place) => (
            <button
              key={place.id}
              onClick={() => handleSelect(place)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'var(--ink, #0f172a)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-sunken, #f8fafc)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ 
                display: 'grid', 
                placeItems: 'center', 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                background: place.type === 'port' ? '#eff6ff' : place.type === 'airport' ? '#f0fdfa' : '#f1f5f9', 
                color: place.type === 'port' ? '#3b82f6' : place.type === 'airport' ? '#14b8a6' : '#94a3b8', 
                flexShrink: 0 
              }}>
                {getIcon(place.type)}
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {place.name}
                </span>
                {(place.country || place.source === 'nominatim') && (
                  <span style={{ fontSize: '12px', color: 'var(--muted, #64748b)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {place.country && <span>{place.country}</span>}
                    {place.source === 'nominatim' && (
                      <span style={{ padding: '2px 6px', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600, fontSize: '9px', letterSpacing: '0.05em' }}>Global</span>
                    )}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
