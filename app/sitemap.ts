import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://projectexinoxano.cat'
  
  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/profile`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ]

  // TODO: Add dynamic legend pages when you have the legend detail routes
  // Example:
  // const legends = await fetchAllLegends()
  // const legendPages = legends.map((legend) => ({
  //   url: `${baseUrl}/legend/${legend.id}`,
  //   lastModified: new Date(legend.updated_at),
  //   changeFrequency: 'monthly' as const,
  //   priority: 0.8,
  // }))

  return [
    ...staticPages,
  ]
}
