import { HandlerContext, Handlers } from "$fresh/server.ts";
import { parseFeed } from "rss";

export const handler: Handlers = {
  async GET(_req: Request, ctx: HandlerContext) {
    const { slug } = ctx.params;

    const project = await fetchScrapboxPages(slug);
    const feed = await parseScrapboxFeed(slug);

    return new Response(
      '<?xml version="1.0" encoding="utf-8"?>' +
        '<rss version="2.0">' +
        "<channel>" +
        `<title>${feed.title.value}</title>` +
        `<link>${feed.links[0]}</link>` +
        `<description>${feed.description}</description>` +
        `<lastBuildDate>${feed.updateDateRaw}</lastBuildDate>` +
        `<docs>${feed.docs}</docs>` +
        `<generator>fresh-rss-proxy</generator>` +
        feed.entries
          .map((entry) => {
            const simpleTitle = entry.title?.value?.replace(
              new RegExp(` - ${slug} - Scrapbox$`, "g"),
              ""
            );
            const page = project.pages.find((p) => p.title === simpleTitle);

            return (
              "<item>" +
              `<title><![CDATA[${simpleTitle}]]></title>` +
              `<link>${entry.links[0].href}</link>` +
              `<guid>${entry.id}</guid>` +
              `<pubDate>${
                page
                  ? new Date(page.created * 1000).toUTCString()
                  : entry.publishedRaw
              }</pubDate>` +
              `<description><![CDATA[${entry.description?.value}]]></description>` +
              "</item>"
            );
          })
          .join("") +
        "</channel>" +
        "</rss>",
      {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "s-maxage=60, stale-while-revalidate",
        },
      }
    );
  },
};

const fetchScrapboxPages = async (
  slug: string
): Promise<{
  pages: {
    title: string;
    created: number;
    updated: number;
  }[];
}> => {
  const resp = await fetch(`https://scrapbox.io/api/pages/${slug}`);

  if (resp.status > 299) {
    throw Error(`Page ${resp.url} returns ${resp.status} ${resp.body}`);
  }
  return await resp.json();
};

const parseScrapboxFeed = async (slug: string) => {
  const resp = await fetch(`https://scrapbox.io/api/feed/${slug}`);

  if (resp.status > 299) {
    throw Error(`Page ${resp.url} returns ${resp.status} ${resp.body}`);
  }
  const xml = await resp.text();
  return await parseFeed(xml);
};
