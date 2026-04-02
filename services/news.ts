export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string };
}

export async function getNews(query: string): Promise<NewsArticle[]> {
  const response = await fetch(`/api/news?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Failed to fetch news');
  const data = await response.json();
  return data.articles ?? [];
}
