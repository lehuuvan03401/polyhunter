import { getArticleBySlug } from '@/lib/help-data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, HelpCircle } from 'lucide-react';

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const article = getArticleBySlug(slug);

    if (!article) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-[#0a0b0d] text-white pt-24 pb-20 px-4 md:px-0">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <Link href="/support" className="flex items-center text-sm text-[#22C55E] hover:text-[#1ea850] transition-colors mb-6">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Help Center
                    </Link>

                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#1C2C24] text-[#22C55E] text-xs font-medium border border-[#22C55E]/20">
                            {article.category}
                        </span>
                    </div>

                    <h1 className="text-4xl font-semibold tracking-tight mb-6">{article.title}</h1>
                </div>

                <div className="prose prose-invert prose-green max-w-none">
                    <div className="p-6 bg-[#1a1b1e] border border-[#2c2d33] rounded-xl text-gray-300">
                        {article.content ? (
                            <div dangerouslySetInnerHTML={{ __html: article.content }} />
                        ) : (
                            <div className="space-y-4">
                                <p>
                                    This is a placeholder content for the article <strong>"{article.title}"</strong>.
                                </p>
                                <p>
                                    In a real application, this content would be fetched from a CMS or stored as markdown/HTML in the <code>help-data.ts</code> file.
                                </p>
                                <div className="mt-8 p-4 bg-[#1e1f24] rounded-lg border border-[#2c2d33]">
                                    <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                                        <HelpCircle className="w-4 h-4 text-[#22C55E]" />
                                        Need more help?
                                    </h3>
                                    <p className="text-sm">
                                        If you couldn't find the answer you were looking for, please contact our support team.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
