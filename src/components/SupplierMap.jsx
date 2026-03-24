import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSuppliers } from '@/hooks/useSuppliers';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

// Fix Leaflet icon issue in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const SupplierMap = () => {
  const { location, getCurrentLocation } = useGeolocation();
  const { suppliers } = useSuppliers();
  const [supplierMarkers, setSupplierMarkers] = useState([]);
  const geocodeCacheRef = useRef(new Map());

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  useEffect(() => {
    let cancelled = false;

    const geocodeSuppliers = async () => {
      if (!suppliers?.length) {
        setSupplierMarkers([]);
        return;
      }

      const markers = [];
      for (const supplier of suppliers.slice(0, 25)) {
        const addressQuery = [supplier.address, supplier.postal_code, supplier.city, supplier.country]
          .filter(Boolean)
          .join(', ');

        if (!addressQuery) continue;

        let coords = geocodeCacheRef.current.get(addressQuery);
        if (!coords) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressQuery)}`
            );
            if (!response.ok) continue;
            const payload = await response.json();
            const firstMatch = payload?.[0];
            if (!firstMatch) continue;
            coords = {
              lat: Number(firstMatch.lat),
              lng: Number(firstMatch.lon),
            };
            geocodeCacheRef.current.set(addressQuery, coords);
          } catch (_error) {
            continue;
          }
        }

        if (!Number.isFinite(coords?.lat) || !Number.isFinite(coords?.lng)) {
          continue;
        }

        markers.push({
          id: supplier.id,
          name: supplier.company_name || supplier.contact_person || supplier.email || 'Supplier',
          address: addressQuery,
          lat: coords.lat,
          lng: coords.lng,
        });
      }

      if (!cancelled) {
        setSupplierMarkers(markers);
      }
    };

    geocodeSuppliers();
    return () => {
      cancelled = true;
    };
  }, [suppliers]);

  const mapCenter = useMemo(() => {
    if (location?.latitude && location?.longitude) {
      return [location.latitude, location.longitude];
    }
    if (supplierMarkers.length > 0) {
      return [supplierMarkers[0].lat, supplierMarkers[0].lng];
    }
    return [50.8503, 4.3517];
  }, [location, supplierMarkers]);

  return (
    <Card className="h-full bg-gray-900 border-gray-800 text-white flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="text-blue-500" /> Supplier Locations
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 min-h-[400px] relative rounded-b-lg overflow-hidden">
        {typeof window !== 'undefined' && (
          <MapContainer
            center={mapCenter}
            zoom={4}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* User Location */}
            {location && (
              <Marker position={[location.latitude, location.longitude]}>
                <Popup>You are here</Popup>
              </Marker>
            )}

            {/* Suppliers */}
            {supplierMarkers.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]}>
                <Popup>
                  <div className="text-black">
                    <strong className="block text-sm">{s.name}</strong>
                    <span className="text-xs">{s.address}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default SupplierMap;
