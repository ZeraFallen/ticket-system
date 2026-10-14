import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { database } from './firebase.js';

function getTicketsCollection() {
  return collection(database, 'tickets');
}

function formatRelativeTime(timestamp) {
  if (!timestamp?.toDate) return 'Just now';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp.toDate().getTime()) / 60_000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  if (elapsedMinutes < 1440) {
    const hours = Math.floor(elapsedMinutes / 60);
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(elapsedMinutes / 1440);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function toTicket(documentSnapshot) {
  const data = documentSnapshot.data();
  return {
    id: data.id,
    issue: data.issue,
    description: data.description,
    category: data.category,
    location: data.location,
    requester: data.requester,
    priority: data.priority,
    status: data.status,
    assignee: data.assignee,
    time: formatRelativeTime(data.updatedAt),
  };
}

export function subscribeTickets(onTickets, onError) {
  const ticketsQuery = query(getTicketsCollection(), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    ticketsQuery,
    (snapshot) => onTickets(snapshot.docs.map(toTicket)),
    onError,
  );
}

export async function createTicket(ticket) {
  const reference = doc(getTicketsCollection());
  const id = `TKT-${reference.id}`;
  await setDoc(reference, {
    ...ticket,
    id,
    status: 'Open',
    assignee: 'Unassigned',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    ...ticket,
    id,
    status: 'Open',
    assignee: 'Unassigned',
    time: 'Just now',
  };
}

export async function updateTicket(id, updates) {
  if (!id.startsWith('TKT-')) throw new Error('Invalid ticket ID.');
  const reference = doc(database, 'tickets', id.slice(4));
  await updateDoc(reference, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
