import { useState } from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import Chip from "./chip";

import { useCloud } from "freestyle-sh";
import { EmojiNoun } from "../cloudstate/emoji-noun";
import type { RoomManagerCS, RoomInfo, RoomCS } from "../cloudstate/infinite-craft";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";


interface InitialState {
	roomInfo: RoomInfo;
	nouns: EmojiNoun[];
}

export default function InfiniteCraftApp(props: InitialState) {
	const queryClient = new QueryClient();
	return (
		<QueryClientProvider client={queryClient}>
			<ApiKeyInput roomInfo={props.roomInfo} />
			<ChipList {...props} />
			<style>{`
				  .chip-container-enter {
					transform: scale(0.8);
					opacity: 0;
				  }
				  .shake {
					animation: shake 0.5s;
				  }
				  @keyframes shake {
					0% { transform: translate(1px, 1px) rotate(0deg); }
					20% { transform: translate(-1px, -2px) rotate(-1deg); }
					40% { transform: translate(-3px, 0px) rotate(1deg); }
					60% { transform: translate(3px, 2px) rotate(0deg); }
					80% { transform: translate(1px, -1px) rotate(1deg); }
					100% { transform: translate(1px, 1px) rotate(0deg); }
				  }
            `}</style>
		</QueryClientProvider>
	)
}

function ApiKeyInput(props: { roomInfo: RoomInfo }) {
	const room = useCloud<typeof RoomCS>(props.roomInfo.id);

	const [textInput, setTextInput] = useState('');

	const updateApiKey = async (str: string) => {
		await room.setAnthropicApiKey(str);
		setTextInput('');
	};

	return (
		<div className="flex flex-row justify-center items-center my-4">
			<input
				type="password"
				className=" bg-slate-800 border border-blue-700 mr-3"
				value={textInput}
				onChange={(ev) => setTextInput(ev.target.value)}
			/>
			<button
				className="bg-blue-900 px-2 py-1"
				onClick={() => updateApiKey(textInput)}
			>
				Set API Key
			</button>
		</div>
	);
}

function ChipList(props: InitialState) {
	const room = useCloud<typeof RoomCS>(props.roomInfo.id);

	const { data: nouns, refetch: refetchNouns } = useQuery({
		queryKey: ["room-manager", "getNouns"],
		queryFn: () => room.getNouns(),
		initialData: props.nouns,
	});
	const { isPending: isCrafting, mutate: craftNoun } = useMutation({
		mutationFn: ({ a, b }: { a: EmojiNoun, b: EmojiNoun }) => room.craftNoun(a, b),
		onSuccess: (emojiNounRes) => {
			// Reset selected chips
			setSelectedIdxs([]);

			if (!emojiNounRes.isNewToRoom) {
				// Noun already exists: shake existing chip
				const chipIdx = nouns.findIndex(noun => noun.text === emojiNounRes.text)
				setShakingIdx(chipIdx);
				setTimeout(() => setShakingIdx(null), 500);
			}

			// Refetch nouns
			refetchNouns();
		},
		onError: (error) => {
			console.error('Error crafting noun:', error);
			setSelectedIdxs([]);
		}
		,
	});

	const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
	const [shakingIdx, setShakingIdx] = useState<number | null>(null);
	const selectChip = (idx: number) => {
		let newSelectedIdxs: number[];

		if (selectedIdxs.includes(idx)) {
			// Currently selected: unselect chip
			newSelectedIdxs = selectedIdxs.filter(selectedIdx => selectedIdx !== idx);
		} else {
			// Not yet selected: select chip
			newSelectedIdxs = [...selectedIdxs, idx];
		}

		if (newSelectedIdxs.length === 2) {
			// Two chips selected: craft noun
			const [a, b] = newSelectedIdxs.map(selectedIdx => nouns[selectedIdx]);
			craftNoun({ a, b });
		}

		setSelectedIdxs(newSelectedIdxs);
	}

	return (
		<div>
			<div className="chip-list mx-6 my-4">
				<TransitionGroup>
					{nouns.map((noun, idx) =>
						<CSSTransition key={idx} timeout={300} classNames="chip-container">
							<Chip
								text={`${noun.emoji} ${noun.text}`}
								isSelected={selectedIdxs.includes(idx)}
								onClick={() => { selectChip(idx) }}
								isShaking={shakingIdx === idx}
								disabled={isCrafting}
							/>
						</CSSTransition>
					)}
				</TransitionGroup>
			</div>
			{isCrafting && <div className="text-center text-xl mt-8">Crafting...</div>}
		</div>
	);
}