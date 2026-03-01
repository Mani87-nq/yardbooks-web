// YaadBooks Web - Parking Slip Types

export type ParkingSlipStatus = 'active' | 'completed' | 'cancelled' | 'expired';

export interface ParkingSlip {
  id: string;
  companyId: string;
  slipNumber: string;
  vehiclePlate: string;
  vehicleType?: 'car' | 'motorcycle' | 'truck' | 'bus' | 'other';
  vehicleColor?: string;
  vehicleDescription?: string;
  driverName?: string;
  driverPhone?: string;
  lotId?: string;
  lotName?: string;
  spotNumber?: string;
  status: ParkingSlipStatus;
  entryTime: string;
  exitTime?: string;
  durationMinutes?: number;
  hourlyRate: number;
  totalAmount?: number;
  isPaid: boolean;
  paymentMethod?: 'cash' | 'card' | 'mobile';
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const PARKING_STATUS_LABELS: Record<ParkingSlipStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const PARKING_STATUS_COLORS: Record<ParkingSlipStatus, string> = {
  active: '#4CAF50',
  completed: '#2196F3',
  cancelled: '#F44336',
  expired: '#FF9800',
};

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  truck: 'Truck',
  bus: 'Bus',
  other: 'Other',
};

export function calculateParkingDuration(entryTime: Date, exitTime?: Date): number {
  const end = exitTime || new Date();
  return Math.ceil((end.getTime() - new Date(entryTime).getTime()) / (1000 * 60));
}

export function calculateParkingAmount(durationMinutes: number, hourlyRate: number): number {
  const hours = Math.ceil(durationMinutes / 60);
  return hours * hourlyRate;
}
