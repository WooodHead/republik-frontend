import React, { Component, Fragment } from 'react'
import { css } from 'glamor'
import Frame from '../Frame'
import ActionBar from '../ActionBar'
import { graphql, compose } from 'react-apollo'
import gql from 'graphql-tag'
import Loader from '../Loader'
import RelatedEpisodes from './RelatedEpisodes'
import SeriesNavButton from './SeriesNavButton'
import * as PayNote from './PayNote'
import PdfOverlay, { getPdfUrl, countImages } from './PdfOverlay'
import Extract from './Extract'
import withT from '../../lib/withT'
import { postMessage } from '../../lib/withInNativeApp'

import Discussion from '../Discussion/Discussion'
import DiscussionIconLink from '../Discussion/IconLink'
import Feed from '../Feed/Format'
import StatusError from '../StatusError'
import SSRCachingBoundary from '../SSRCachingBoundary'
import withMembership from '../Auth/withMembership'
import ArticleGallery from './ArticleGallery'

import {
  colors,
  mediaQueries,
  Center
} from '@project-r/styleguide'

import { HEADER_HEIGHT, HEADER_HEIGHT_MOBILE } from '../constants'
import { PUBLIC_BASE_URL } from '../../lib/constants'

import { renderMdast } from 'mdast-react-render'

import createArticleSchema from '@project-r/styleguide/lib/templates/Article'
import createFormatSchema from '@project-r/styleguide/lib/templates/Format'
import createDossierSchema from '@project-r/styleguide/lib/templates/Dossier'
import createDiscussionSchema from '@project-r/styleguide/lib/templates/Discussion'
import createNewsletterSchema from '@project-r/styleguide/lib/templates/EditorialNewsletter/web'

const schemaCreators = {
  editorial: createArticleSchema,
  meta: createArticleSchema,
  article: createArticleSchema,
  format: createFormatSchema,
  dossier: createDossierSchema,
  discussion: createDiscussionSchema,
  editorialNewsletter: createNewsletterSchema
}

const getSchemaCreator = template => {
  const key = template || Object.keys(schemaCreators)[0]
  const schema = schemaCreators[key]

  if (!schema) {
    throw new Error(`Unkown Schema ${key}`)
  }
  return schema
}

const styles = {
  bar: css({
    display: 'inline-block',
    marginTop: '15px',
    [mediaQueries.mUp]: {
      marginTop: '20px'
    }
  })
}

const ArticleActionBar = ({ title, discussionId, discussionPage, discussionPath, dossierUrl, onAudioClick, onPdfClick, pdfUrl, t, url, inNativeApp }) => (
  <div>
    <ActionBar
      url={url}
      shareOverlayTitle={t('article/share/title')}
      fill={colors.text}
      dossierUrl={dossierUrl}
      onPdfClick={onPdfClick}
      pdfUrl={pdfUrl}
      emailSubject={t('article/share/emailSubject', {
        title
      })}
      onAudioClick={onAudioClick}
      inNativeApp={inNativeApp}
    />
    {discussionId && process.browser &&
      <DiscussionIconLink discussionId={discussionId} shouldUpdate={!discussionPage} path={discussionPath} style={{marginLeft: 7}} />
    }
  </div>
)

const getDocument = gql`
  query getDocument($path: String!) {
    article: document(path: $path) {
      id
      content
      meta {
        template
        path
        title
        description
        image
        facebookDescription
        facebookImage
        facebookTitle
        twitterDescription
        twitterImage
        twitterTitle
        discussionId
        discussion {
          meta {
            path
            discussionId
          }
        }
        color
        format {
          meta {
            path
            title
            color
            kind
          }
        }
        dossier {
          meta {
            title
            path
          }
        }
        series {
          title
          episodes {
            title
            publishDate
            label
            image
            document {
              meta {
                title
                publishDate
                path
                image
              }
            }
          }
        }
        audioSource {
          mp3
          aac
          ogg
        }
      }
    }
  }
`

class ArticlePage extends Component {
  constructor (props) {
    super(props)

    this.barRef = ref => {
      this.bar = ref
    }

    this.bottomBarRef = ref => {
      this.bottomBar = ref
    }

    this.toggleAudio = () => {
      if (this.props.inNativeApp) {
        postMessage({ type: 'show-audio-player' })
      } else {
        this.setState({
          showAudioPlayer: !this.state.showAudioPlayer
        })
      }
    }

    this.togglePdf = () => {
      this.setState({
        showPdf: !this.state.showPdf
      })
    }

    this.state = {
      primaryNavExpanded: false,
      secondaryNavExpanded: false,
      showSecondary: false,
      showAudioPlayer: false,
      ...this.deriveStateFromProps(props)
    }

    this.onScroll = () => {
      const y = window.pageYOffset
      const mobile = window.innerWidth < mediaQueries.mBreakPoint
      const isAwayFromBottomBar =
        !this.bottomBarY || y + window.innerHeight < this.bottomBarY

      const headerHeight = mobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT

      if (
        isAwayFromBottomBar &&
        (
          this.state.isSeries
            ? y > headerHeight
            : y + headerHeight > this.y + this.barHeight
        )
      ) {
        if (!this.state.showSecondary) {
          postMessage({ type: 'show-secondary-nav' })
          this.setState({ showSecondary: true })
        }
      } else {
        if (this.state.showSecondary) {
          postMessage({ type: 'hide-secondary-nav' })
          this.setState({ showSecondary: false })
        }
        if (this.state.secondaryNavExpanded) {
          this.setState({ secondaryNavExpanded: false })
        }
      }
    }

    this.measure = () => {
      if (!this.state.isSeries) {
        if (this.bar) {
          const rect = this.bar.getBoundingClientRect()
          this.y = window.pageYOffset + rect.top
          this.barHeight = rect.height
          this.x = window.pageXOffset + rect.left
        }
      }
      if (this.bottomBar) {
        const bottomRect = this.bottomBar.getBoundingClientRect()
        this.bottomBarY = window.pageYOffset + bottomRect.top
      }
      this.onScroll()
    }

    this.onPrimaryNavExpandedChange = expanded => {
      this.setState({
        primaryNavExpanded: expanded,
        secondaryNavExpanded: expanded ? false : this.state.secondaryNavExpanded
      })
    }

    this.onSecondaryNavExpandedChange = expanded => {
      this.setState({
        primaryNavExpanded: expanded ? false : this.state.primaryNavExpanded,
        secondaryNavExpanded: expanded
      })
    }

    this.onMessage = e => {
      const message = JSON.parse(e.data)
      switch (message.type) {
        case 'toggle-pdf':
          return this.togglePdf()
        case 'open-secondary-menu':
          return this.setState({ secondaryNavExpanded: true })
        case 'close-secondary-menu':
          return this.setState({ secondaryNavExpanded: false })
      }
    }
  }

  deriveStateFromProps ({ t, data: { article }, inNativeApp }) {
    const meta = article && {
      ...article.meta,
      url: `${PUBLIC_BASE_URL}${article.meta.path}`
    }

    const discussion = meta && meta.discussion
    const linkedDiscussionId = meta && (
      meta.discussionId ||
      (discussion && discussion.meta.discussionId)
    )

    const hasPdf = meta && meta.template === 'article'

    const actionBar = meta && (
      <ArticleActionBar
        t={t}
        url={meta.url}
        title={meta.title}
        discussionPage={!!meta.discussionId}
        discussionId={linkedDiscussionId}
        discussionPath={discussion && discussion.meta.path}
        dossierUrl={meta.dossier && meta.dossier.meta.path}
        onAudioClick={meta.audioSource && this.toggleAudio}
        onPdfClick={(
          hasPdf && countImages(article.content) > 0 &&
          this.togglePdf
        )}
        pdfUrl={hasPdf && getPdfUrl(meta)}
        inNativeApp={inNativeApp}
      />
    )

    const schema = meta && getSchemaCreator(meta.template)({
      t,
      titleBlockAppend: (
        <div ref={this.barRef} {...styles.bar}>
          {actionBar}
        </div>
      )
    })

    const isSeries = meta && !!meta.series

    return {
      schema,
      meta,
      actionBar,
      isSeries
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.data.article !== this.props.data.article) {
      postMessage({
        type: 'article-opened',
        payload: nextProps.data.article
      })

      this.setState(this.deriveStateFromProps(nextProps))
    }
  }

  componentDidMount () {
    window.addEventListener('scroll', this.onScroll)
    window.addEventListener('resize', this.measure)

    if (this.props.inNativeApp) {
      document.addEventListener('message', this.onMessage)
    }

    if (this.props.data.article) {
      postMessage({
        type: 'article-opened',
        payload: this.props.data.article
      })
    }

    this.measure()
  }

  componentDidUpdate () {
    this.measure()
  }

  componentWillUnmount () {
    postMessage({ type: 'article-closed' })

    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('resize', this.measure)

    if (this.props.inNativeApp) {
      document.removeEventListener('message', this.onMessage)
    }
  }

  render () {
    const { url, t, data, data: {article}, isMember, inNativeApp } = this.props

    const { meta, actionBar, schema, showAudioPlayer } = this.state

    const series = meta && meta.series
    const episodes = series && series.episodes

    const seriesNavButton = series ? (
      <SeriesNavButton
        t={t}
        url={url}
        series={series}
        onSecondaryNavExpandedChange={this.onSecondaryNavExpandedChange}
        expanded={this.state.secondaryNavExpanded}
        inNativeApp={inNativeApp}
      />
    ) : null

    const formatMeta = meta && (
      meta.template === 'format'
        ? meta
        : meta.format && meta.format.meta
    )
    const formatColor = formatMeta && formatMeta.color

    const audioSource = showAudioPlayer ? meta && meta.audioSource : null

    if (url.query.extract) {
      return <Loader loading={data.loading} error={data.error} render={() => {
        if (!article) {
          return <StatusError
            url={url}
            statusCode={404}
            serverContext={this.props.serverContext} />
        }

        return <Extract
          ranges={url.query.extract}
          schema={schema}
          unpack={url.query.unpack}
          mdast={{
            ...article.content,
            format: meta.format
          }} />
      }} />
    }

    return (
      <Frame
        raw
        url={url}
        meta={meta}
        onPrimaryNavExpandedChange={this.onPrimaryNavExpandedChange}
        primaryNavExpanded={this.state.primaryNavExpanded}
        secondaryNav={(isMember && seriesNavButton) || (!inNativeApp && actionBar)}
        showSecondary={this.state.showSecondary}
        formatColor={formatColor}
        audioSource={audioSource}
        audioCloseHandler={this.toggleAudio}
      >
        <Loader loading={data.loading} error={data.error} render={() => {
          if (!article) {
            return <StatusError
              url={url}
              statusCode={404}
              serverContext={this.props.serverContext} />
          }

          const isFormat = meta.template === 'format'

          return (
            <Fragment>
              {!isFormat && <PayNote.Before />}
              {this.state.showPdf &&
                <PdfOverlay
                  article={article}
                  onClose={this.togglePdf} />}
              <ArticleGallery article={article}>
                <SSRCachingBoundary cacheKey={article.id}>
                  {() => renderMdast({
                    ...article.content,
                    format: meta.format
                  }, schema)}
                </SSRCachingBoundary>
              </ArticleGallery>
              {meta.template === 'article' && <Center>
                <div ref={this.bottomBarRef} {...styles.bar}>
                  {actionBar}
                </div>
              </Center>}
              {meta.discussionId && <Center>
                <Discussion
                  discussionId={meta.discussionId}
                  focusId={url.query.focus}
                  mute={!!url.query.mute}
                  url={url} />
              </Center>}
              {isMember && episodes && <RelatedEpisodes episodes={episodes} path={meta.path} />}
              {isFormat && <Feed formatId={article.id} />}
              <br />
              <br />
              <br />
              <br />
              {!isFormat && <PayNote.After isSeries={!!series} />}
            </Fragment>
          )
        }} />
      </Frame>
    )
  }
}

export default compose(
  withT,
  withMembership,
  graphql(getDocument, {
    options: ({url: {asPath}}) => ({
      variables: {
        path: asPath.split('?')[0]
      }
    })
  })
)(ArticlePage)
