import * as React from 'react';
import {GlobalErrorBoundary} from './components/error';
import {LoadingCurtain} from './components/loading-curtain/loading-curtain';
import {LocaleSwitcher} from './store/locale-switcher';
import {PrefsContextProvider} from './store/prefs';
import {Routes} from './routes';
import {StoriesContextProvider} from './store/stories';
import {StoryFormatsContextProvider} from './store/story-formats';
import {StateLoader} from './store/state-loader';
import {ThemeSetter} from './store/theme-setter';
import './styles/typography.css';
import {
  BroadcastChannelNetworkAdapter,
  WebSocketClientAdapter,
  IndexedDBStorageAdapter,
   Repo } from "../automerge-repo/packages/automerge-react/src"

const repo = new Repo({
  network: [new BroadcastChannelNetworkAdapter(),
			new WebSocketClientAdapter("wss://duck-composed-closely.ngrok-free.app"), 
  ], // FIXME
  storage: new IndexedDBStorageAdapter(),
});

export const App: React.FC = () => (
	<GlobalErrorBoundary>
		<PrefsContextProvider>
			<LocaleSwitcher />
			<ThemeSetter />
			<StoryFormatsContextProvider>
				<StoriesContextProvider repo={repo}>
					<StateLoader>
						<React.Suspense fallback={<LoadingCurtain />}>
							<Routes repo={repo} />
						</React.Suspense>
					</StateLoader>
				</StoriesContextProvider>
			</StoryFormatsContextProvider>
		</PrefsContextProvider>
	</GlobalErrorBoundary>
);
