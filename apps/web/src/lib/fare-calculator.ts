/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }
  
  function deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
  
  /**
   * Check if address contains airport keywords
   */
  export function isAirportLocation(address: string): boolean {
    const airportKeywords = ['airport', 'bandara', 'ssk ii', 'ssk 2', 'bandara ssk ii'];
    return airportKeywords.some(keyword => address.toLowerCase().includes(keyword));
  }
  
  /**
   * Calculate taxi fare based on Indonesian pricing structure
   * Rp 60,000 for first kilometer + Rp 6,000 for each additional kilometer
   */
  export function calculateFare(distanceKm: number, pickupAddress?: string, destinationAddress?: string) {
    const baseFare = 60000; // First kilometer
    const additionalKmRate = 6000; // Per additional kilometer
    const airportFareAmount = 5000;
  
    // raw additional km
    const rawAdditionalKm = Math.max(0, distanceKm - 1);
  
    // round to 1 decimal as you prefer (consistent)
    const additionalKm = Math.round(rawAdditionalKm * 10) / 10;
  
    // compute additionalFare from the rounded additionalKm (KEEP CONSISTENT)
    const additionalFare = Math.round(additionalKm * additionalKmRate);
  
    // Check if it's an airport trip
    const isAirportTrip = (pickupAddress && isAirportLocation(pickupAddress)) ||
                         (destinationAddress && isAirportLocation(destinationAddress));
    const appliedAirportFare = isAirportTrip ? airportFareAmount : 0;
    const totalFare = baseFare + additionalFare + appliedAirportFare;
  
    return {
      distance: distanceKm,
      baseFare,
      additionalFare,
      airportFare: appliedAirportFare,
      totalFare,
      additionalKm,             // rounded
      farePerKm: additionalKmRate, // return explicit rate to avoid recalculation bugs
      isAirportTrip: Boolean(isAirportTrip),
    };
  }
  