import { VehicleType } from "@prisma/client";

export interface VehicleTypeConfig {
  id: VehicleType;
  name: string;
  description: string;
  multiplier: number;
  capacity: number;
  features: string[];
  icon: string;
  estimatedArrival: string;
}

export const VEHICLE_TYPES: VehicleTypeConfig[] = [
  // {
  //   id: "MOTORCYCLE",
  //   name: "KopsiKu Bike",
  //   description: "Quick & affordable motorcycle ride",
  //   multiplier: 0.7,
  //   capacity: 1,
  //   features: ["Fast", "Traffic-friendly", "Helmet provided"],
  //   icon: "motorcycle",
  //   estimatedArrival: "1-2 mins",
  // },
  {
    id: "ECONOMY",
    name: "KopsiKu Economy",
    description: "Standard comfortable car ride",
    multiplier: 1.0,
    capacity: 4,
    features: ["Air Conditioning", "Music System"],
    icon: "car",
    estimatedArrival: "2-3 mins",
  },
  // {
  //   id: "PREMIUM",
  //   name: "KopsiKu Premium",
  //   description: "Premium car with extra comfort",
  //   multiplier: 1.4,
  //   capacity: 4,
  //   features: ["Premium AC", "Leather Seats", "WiFi", "Water Bottles"],
  //   icon: "car-premium",
  //   estimatedArrival: "3-4 mins",
  // },
  // {
  //   id: "LUXURY",
  //   name: "KopsiKu Luxury",
  //   description: "Luxury experience with top-tier vehicles",
  //   multiplier: 2.0,
  //   capacity: 4,
  //   features: ["Luxury Interior", "Premium Sound", "Refreshments", "Professional Driver"],
  //   icon: "car-luxury",
  //   estimatedArrival: "4-5 mins",
  // },
];

export const getVehicleType = (id: VehicleType): VehicleTypeConfig | undefined => {
  return VEHICLE_TYPES.find(type => type.id === id);
};

export const calculateVehicleFare = (baseFare: number, vehicleType: VehicleType): number => {
  const vehicle = getVehicleType(vehicleType);
  return Math.round(baseFare * (vehicle?.multiplier || 1.0));
};