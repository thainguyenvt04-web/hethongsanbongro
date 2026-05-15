// Hệ thống lưu trữ booking.
// Đã chuyển sang Supabase

import { supabase, isMockMode } from './supabase';

export type SavedBooking = {
  id: string;
  courtId: string;
  courtName: string;
  userId: string;
  userEmail: string;
  customerName: string;
  customerPhone: string;
  date: string;             // yyyy-MM-dd
  ranges: { start: number; end: number }[];
  total: number;
  paid: boolean;            
  createdAt: string;        
};

const getMockBookings = (): SavedBooking[] => {
  const data = localStorage.getItem('mockBookings');
  return data ? JSON.parse(data) : [];
};

const saveMockBookings = (bookings: SavedBooking[]) => {
  localStorage.setItem('mockBookings', JSON.stringify(bookings));
};

export async function getBookings(): Promise<SavedBooking[]> {
  if (isMockMode) return getMockBookings();
  const { data, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }
  return (data as any[]).map(mapFromRow);
}

export async function getAdminBookings(): Promise<SavedBooking[]> {
  if (isMockMode) return getMockBookings();
  
  try {
    const res = await fetch('/api/admin/bookings');
    if (!res.ok) throw new Error("Failed to fetch admin bookings");
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return (json.bookings as any[]).map(mapFromRow);
  } catch (error) {
    console.error("Error fetching admin bookings:", error);
    return [];
  }
}

export async function saveBooking(booking: SavedBooking): Promise<void> {
  if (isMockMode) {
    const bookings = getMockBookings();
    bookings.push(booking);
    saveMockBookings(bookings);
    return;
  }
  const { error } = await supabase.from('bookings').insert({
    id: booking.id,
    court_id: booking.courtId,
    court_name: booking.courtName,
    user_id: booking.userId,
    user_email: booking.userEmail,
    customer_name: booking.customerName,
    customer_phone: booking.customerPhone,
    date: booking.date,
    ranges: booking.ranges,
    total: booking.total,
    paid: booking.paid,
    created_at: booking.createdAt,
  });
  
  if (error) {
    console.error("Error saving booking:", error);
    throw error;
  }
}

export async function getBookingsByUser(userId: string): Promise<SavedBooking[]> {
  if (isMockMode) return getMockBookings().filter(b => b.userId === userId);
  const { data, error } = await supabase.from('bookings').select('*').eq('user_id', userId);
  if (error) return [];
  return (data as any[]).map(mapFromRow);
}

export async function getBookingsByUserToday(userId: string): Promise<SavedBooking[]> {
  const today = new Date().toISOString().split('T')[0];
  if (isMockMode) return getMockBookings().filter(b => b.userId === userId && b.date === today);
  const { data, error } = await supabase.from('bookings').select('*').eq('user_id', userId).eq('date', today);
  if (error) return [];
  return (data as any[]).map(mapFromRow);
}

export async function getPaidBookingsByUserToday(userId: string): Promise<SavedBooking[]> {
  const today = new Date().toISOString().split('T')[0];
  if (isMockMode) return getMockBookings().filter(b => b.userId === userId && b.date === today && b.paid);
  const { data, error } = await supabase.from('bookings').select('*').eq('user_id', userId).eq('date', today).eq('paid', true);
  if (error) return [];
  return (data as any[]).map(mapFromRow);
}

export async function getAllPaidBookingsToday(): Promise<SavedBooking[]> {
  const today = new Date().toISOString().split('T')[0];
  if (isMockMode) return getMockBookings().filter(b => b.date === today && b.paid);
  const { data, error } = await supabase.from('bookings').select('*').eq('date', today).eq('paid', true);
  if (error) return [];
  return (data as any[]).map(mapFromRow);
}

export async function markBookingPaid(bookingId: string): Promise<void> {
  if (isMockMode) {
    const bookings = getMockBookings();
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index !== -1) {
      bookings[index].paid = true;
      saveMockBookings(bookings);
    }
    return;
  }
  const { error } = await supabase.from('bookings').update({ paid: true }).eq('id', bookingId);
  if (error) {
    console.error("Error marking as paid:", error);
    throw error;
  }
}

export async function markBookingUnpaid(bookingId: string): Promise<void> {
  if (isMockMode) {
    const bookings = getMockBookings();
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index !== -1) {
      bookings[index].paid = false;
      saveMockBookings(bookings);
    }
    return;
  }
  const { error } = await supabase.from('bookings').update({ paid: false }).eq('id', bookingId);
  if (error) {
    console.error("Error marking as unpaid:", error);
    throw error;
  }
}

export async function deleteBooking(bookingId: string): Promise<void> {
  if (isMockMode) {
    const bookings = getMockBookings().filter(b => b.id !== bookingId);
    saveMockBookings(bookings);
    return;
  }
  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) {
    console.error("Error deleting booking:", error);
    throw error;
  }
}

// ==============================
// CÁC HÀM DÀNH RIÊNG CHO ADMIN
// (Sử dụng API Backend để bypass RLS)
// ==============================

export async function deleteAdminBooking(bookingId: string): Promise<void> {
  if (isMockMode) return deleteBooking(bookingId);
  
  const res = await fetch(`/api/admin/bookings/${bookingId}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.error !== 0) throw new Error(data.error);
}

export async function updateAdminBookingPaid(bookingId: string, paid: boolean): Promise<void> {
  if (isMockMode) {
    if (paid) await markBookingPaid(bookingId);
    else await markBookingUnpaid(bookingId);
    return;
  }
  
  const res = await fetch(`/api/admin/bookings/${bookingId}/paid`, { 
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid })
  });
  const data = await res.json();
  if (data.error !== 0) throw new Error(data.error);
}

function mapFromRow(row: any): SavedBooking {
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.court_name,
    userId: row.user_id,
    userEmail: row.user_email,
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone,
    date: row.date,
    ranges: row.ranges,
    total: row.total,
    paid: row.paid,
    createdAt: row.created_at,
  };
}
