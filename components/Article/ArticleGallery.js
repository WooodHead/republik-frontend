import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import { Gallery } from '@project-r/styleguide/lib/components/Gallery'
import get from 'lodash.get'
import {
  imageSizeInfo
} from 'mdast-react-render/lib/utils'
import { postMessage } from '../../lib/withInNativeApp'

const shouldInclude = (el) =>
  el && el.identifier === 'FIGURE' && get(el, 'data.excludeFromGallery', false) !== true

const findFigures = (node, acc = []) => {
  if (node && node.children && node.children.length > 0) {
    node.children.forEach(
      c => {
        if (shouldInclude(c)) {
          acc.push(c)
        } else {
          findFigures(c, acc)
        }
      }
    )
  }
  return acc
}

const getImageProps = (node) => {
  const src = get(node, 'children[0].children[0].url', '')
  const alt = get(node, 'children[0].children[0].alt', '')
  const caption = get(node, 'children[1].children[0].value', '')
  const credit = get(node, 'children[1].children[1].children[0].value', '')
  return {
    src,
    alt,
    caption,
    credit
  }
}

const getGalleryItems = ({ article }) => {
  return findFigures(article.content)
    .map(getImageProps)
    .filter(i => imageSizeInfo(i.src) && imageSizeInfo(i.src).width > 600)
}

class ArticleGallery extends Component {
  constructor (props) {
    super(props)
    this.state = {
      show: false,
      startItemSrc: null,
      ...this.getDerivedStateFromProps(props)
    }

    this.toggleGallery = (nextSrc = '') => {
      const nextShow = !this.state.show
      const { galleryItems } = this.state
      if (nextShow && galleryItems.some(i => i.src === nextSrc.split('&')[0])) {
        this.setState({
          show: true,
          startItemSrc: nextSrc
        }, () => postMessage({ type: 'gallery-opened' })
        )
      } else {
        this.setState({
          show: false,
          startItemSrc: null
        }, () => postMessage({ type: 'gallery-closed' })
        )
      }
    }

    this.getChildContext = () => ({
      toggleGallery: this.toggleGallery
    })
  }

  getDerivedStateFromProps (nextProps) {
    return {
      galleryItems: getGalleryItems(nextProps)
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.article !== this.props.article) {
      this.setState(this.getDerivedStateFromProps(nextProps))
    }
  }

  render () {
    const { children } = this.props
    const { article } = this.props
    const { show, startItemSrc, galleryItems } = this.state
    const enabled = get(article, 'content.meta.gallery', true)
    if (article.content && enabled && show) {
      return (
        <Fragment>
          <Gallery
            onClose={this.toggleGallery}
            items={galleryItems}
            startItemSrc={startItemSrc}
          />
          { children }
        </Fragment>
      )
    } else {
      return children
    }
  }
}

ArticleGallery.propTypes = {
  article: PropTypes.object.isRequired
}

ArticleGallery.childContextTypes = {
  toggleGallery: PropTypes.func
}

export default ArticleGallery
