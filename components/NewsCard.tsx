'use client';

import { NewsArticle } from '@/services/news';
import Image from 'next/image';

interface Props {
  articles: NewsArticle[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NewsCard({ articles }: Props) {
  if (!articles.length) {
    return <p className="text-slate-400 text-sm">No travel news found for this destination.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {articles.map((article, i) => (
        <a
          key={i}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col rounded-xl border border-slate-700 bg-slate-800/40 hover:border-brand-500/50 hover:bg-slate-800/80 transition-all overflow-hidden"
        >
          {article.image && (
            <div className="relative h-36 overflow-hidden bg-slate-700">
              <Image
                src={article.image}
                alt={article.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                unoptimized
              />
            </div>
          )}
          <div className="p-4 flex-1 flex flex-col">
            <p className="text-sm font-semibold text-white line-clamp-2 mb-2 group-hover:text-brand-300 transition-colors">
              {article.title}
            </p>
            {article.description && (
              <p className="text-xs text-slate-400 line-clamp-2 mb-3 flex-1">{article.description}</p>
            )}
            <div className="flex items-center justify-between mt-auto">
              <span className="text-xs text-brand-300">{article.source?.name}</span>
              <span className="text-xs text-slate-500">{timeAgo(article.publishedAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
