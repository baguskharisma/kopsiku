export interface VehicleType {
    id: string;
    name: string;
    description: string;
    multiplier: number;
    capacity: number;
    features: string[];
    icon: string;
    estimatedArrival: string;
  }
  
  export const VEHICLE_TYPES: VehicleType[] = [
    {
      id: "M",
      name: "TaxiGo Medium",
      description: "Standard comfortable ride",
      multiplier: 1.0,
      capacity: 4,
      features: ["Air Conditioning", "Music System"],
      icon: "car",
      estimatedArrival: "2-3 mins",
    },
    {
      id: "L",
      name: "TaxiGo Large",
      description: "Spacious family ride",
      multiplier: 1.3,
      capacity: 6,
      features: ["Air Conditioning", "Extra Space", "USB Charging"],
      icon: "car-suv",
      estimatedArrival: "3-4 mins",
    },
    {
      id: "XL",
      name: "TaxiGo Premium",
      description: "Luxury comfort experience",
      multiplier: 1.6,
      capacity: 6,
      features: ["Premium AC", "Leather Seats", "WiFi", "Water Bottles"],
      icon: "car-luxury",
      estimatedArrival: "4-5 mins",
    },
  ];
  
  export const getVehicleType = (id: string): VehicleType | undefined => {
    return VEHICLE_TYPES.find(type => type.id === id);
  };
  
  export const calculateVehicleFare = (baseFare: number, vehicleType: string): number => {
    const vehicle = getVehicleType(vehicleType);
    return Math.round(baseFare * (vehicle?.multiplier || 1.0));
  };    