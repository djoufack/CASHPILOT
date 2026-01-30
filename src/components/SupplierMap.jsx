
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useGeolocation } from '@/hooks/useGeolocation';
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
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const SupplierMap = () => {
  const { location, getCurrentLocation } = useGeolocation();
  const [suppliers, setSuppliers] = useState([
     // Mock data
     { id: 1, name: "Tech Solutions Ltd", lat: 48.8566, lng: 2.3522, address: "Paris, France" },
     { id: 2, name: "Global Logistics", lat: 51.5074, lng: -0.1278, address: "London, UK" },
     { id: 3, name: "Fast Supplies", lat: 40.7128, lng: -74.0060, address: "New York, USA" }
  ]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

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
             center={[48.8566, 2.3522]} 
             zoom={4} 
             style={{ height: "100%", width: "100%", zIndex: 0 }}
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
             {suppliers.map(s => (
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
