import { useEffect, useState } from 'react';
import { isBackendConfigured } from './lib/supabase';
import { useRouter } from './app/useRouter';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import AuthScreen from './features/auth/AuthScreen';
import SplashScreen from './features/auth/SplashScreen';
import ProfileScreen from './features/profile/ProfileScreen';
import SoundSettingsScreen from './features/profile/SoundSettingsScreen';
import UpdatesScreen from './features/updates/UpdatesScreen';
import HomeScreen from './features/rooms/HomeScreen';
import GameHubScreen from './features/rooms/GameHubScreen';
import CreateRoomScreen from './features/rooms/CreateRoomScreen';
import RoomListScreen from './features/rooms/RoomListScreen';
import LobbyScreen from './features/lobby/LobbyScreen';
import { findMyRoom } from './features/rooms/api';

function Message({ text }: { text: string }) {
  return (
    <main className="screen center">
      <h1 className="display logo">
        SING <span style={{ color: 'var(--flame)' }}>&amp;</span> <span style={{ color: 'var(--butter)' }}>PLAY</span>
      </h1>
      <p className="muted">{text}</p>
    </main>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const userId = session?.user.id;
  const { route, go, goBack, start } = useRouter(!!userId && ready);

  // عند الدخول: لو اللاعب داخل غرفة نشطة يرجع لها مباشرة
  useEffect(() => {
    if (!userId) {
      setReady(false);
      start();
      return;
    }
    let live = true;
    findMyRoom(userId)
      .then((roomId) => {
        if (live) start(roomId ?? undefined);
      })
      .catch(() => {
        if (live) start();
      })
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [userId, start]);

  if (loading) return <Message text="جارٍ التحميل…" />;
  if (!session) return started ? <AuthScreen /> : <SplashScreen onStart={() => setStarted(true)} />;
  if (!ready) return <Message text="جارٍ التحميل…" />;

  switch (route.name) {
    case 'create':
      return <CreateRoomScreen go={go} initialVisibility={route.visibility} />;
    case 'game':
      return <GameHubScreen go={go} game={route.game} />;
    case 'rooms':
      return <RoomListScreen go={go} />;
    case 'profile':
      return <ProfileScreen onBack={goBack} onSound={() => go({ name: 'sound' })} onUpdates={() => go({ name: 'updates' })} />;
    case 'sound':
      return <SoundSettingsScreen onBack={goBack} />;
    case 'updates':
      return <UpdatesScreen onBack={goBack} />;
    case 'lobby':
      return <LobbyScreen roomId={route.roomId} go={go} />;
    default:
      return <HomeScreen go={go} />;
  }
}

export default function App() {
  if (!isBackendConfigured) return <Message text="لم يتم ربط Supabase بعد (راجع .env.example)" />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
