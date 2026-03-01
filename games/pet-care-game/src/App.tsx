import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useExpeditions } from './hooks/useExpeditions';
import { usePassiveIncome } from './hooks/usePassiveIncome';
import { tickStats } from './engine/statDecay';
import { MAX_OFFLINE_SECONDS } from './engine/constants';
import { TitleScreen } from './screens/TitleScreen/TitleScreen';
import { EggShop } from './screens/EggShop/EggShop';
import { HatchingScreen } from './screens/HatchingScreen/HatchingScreen';
import { MainCare } from './screens/MainCare/MainCare';
import { WildDragons } from './screens/WildDragons/WildDragons';
import { MinigameHub } from './screens/MinigameHub/MinigameHub';
import { ParkCleaning } from './screens/minigames/ParkCleaning/ParkCleaning';
import { HelpingJobs } from './screens/minigames/HelpingJobs/HelpingJobs';
import { CageCleaning } from './screens/minigames/CageCleaning/CageCleaning';
import { DragonHome } from './screens/DragonHome/DragonHome';
import { DragonRacing } from './screens/minigames/DragonRacing/DragonRacing';
import { TreasureHunt } from './screens/minigames/TreasureHunt/TreasureHunt';
import { DragonCooking } from './screens/minigames/DragonCooking/DragonCooking';
import './App.css';

function App() {
  const currentScreen = useGameStore(s => s.currentScreen);

  // Check expeditions globally
  useExpeditions();
  usePassiveIncome();

  // Offline catchup on mount
  useEffect(() => {
    const state = useGameStore.getState();
    if (!state.dragon || !state.lastSaveTimestamp) return;

    const elapsed = Math.min(
      (Date.now() - state.lastSaveTimestamp) / 1000,
      MAX_OFFLINE_SECONDS
    );

    if (elapsed > 10 && state.dragon.stage > 0) {
      const newStats = tickStats(state.dragon.stats, elapsed);
      useGameStore.setState({
        dragon: { ...state.dragon, stats: newStats },
        lastSaveTimestamp: Date.now(),
      });
    }
  }, []);

  // Save on page unload
  useEffect(() => {
    const handleUnload = () => {
      useGameStore.setState({ lastSaveTimestamp: Date.now() });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'title': return <TitleScreen />;
      case 'egg-shop': return <EggShop />;
      case 'hatching': return <HatchingScreen />;
      case 'main-care': return <MainCare />;
      case 'wild-dragons': return <WildDragons />;
      case 'minigame-hub': return <MinigameHub />;
      case 'minigame-park': return <ParkCleaning />;
      case 'minigame-jobs': return <HelpingJobs />;
      case 'minigame-cage': return <CageCleaning />;
      case 'dragon-home': return <DragonHome />;
      case 'minigame-racing': return <DragonRacing />;
      case 'minigame-treasure': return <TreasureHunt />;
      case 'minigame-cooking': return <DragonCooking />;
      default: return <TitleScreen />;
    }
  };

  return (
    <div className="app-container">
      {renderScreen()}
    </div>
  );
}

export default App;
