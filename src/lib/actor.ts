// Usuario que está operando el sistema en este navegador.
// Lo fija el AuthProvider al iniciar sesión; lo leen la bitácora y el candado de días cerrados.

export interface Actor {
  id: string;
  email: string;
  nombre?: string;
  rol?: string;
}

let currentActor: Actor | null = null;

export function setActor(actor: Actor | null): void {
  currentActor = actor;
}

export function getActor(): Actor | null {
  return currentActor;
}

export function isActorAdmin(): boolean {
  return (currentActor?.rol || '').toUpperCase() === 'ADMIN';
}
