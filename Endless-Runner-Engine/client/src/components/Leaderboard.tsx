import { useScores } from "@/hooks/use-scores";
import { motion } from "framer-motion";
import { Trophy, Medal } from "lucide-react";

export function Leaderboard() {
  const { data: scores, isLoading } = useScores();

  return (
    <div className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm rounded-3xl border-4 border-white shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-center">
        <h2 className="text-4xl font-display text-white text-stroke flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-100" />
          TOP RUNNERS
        </h2>
      </div>
      
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {scores?.slice(0, 5).map((score, index) => (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                key={score.id}
                className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100 hover:border-primary/30 transition-colors"
              >
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center font-display text-xl border-2
                  ${index === 0 ? 'bg-yellow-100 border-yellow-300 text-yellow-600' : 
                    index === 1 ? 'bg-slate-200 border-slate-300 text-slate-600' :
                    index === 2 ? 'bg-orange-100 border-orange-200 text-orange-600' :
                    'bg-white border-slate-100 text-slate-400'}
                `}>
                  {index + 1}
                </div>
                
                <div className="flex-1">
                  <div className="font-bold text-lg uppercase text-slate-700">{score.username}</div>
                  <div className="text-xs text-slate-400 font-bold tracking-wider">
                    {new Date(score.createdAt!).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-display text-2xl text-primary">{score.score}</div>
                  <div className="text-xs font-bold text-yellow-500 flex items-center justify-end gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    {score.coins}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {(!scores || scores.length === 0) && (
              <div className="text-center py-8 text-muted-foreground font-bold">
                No scores yet. Be the first!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
