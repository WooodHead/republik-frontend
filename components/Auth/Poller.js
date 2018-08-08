import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import { graphql, compose } from 'react-apollo'
import { meQuery } from '../../lib/apollo/withMe'

import withT from '../../lib/withT'

import ErrorMessage from '../ErrorMessage'

import { SUPPORTED_TOKEN_TYPES } from '../constants'

import {
  Label,
  Interaction,
  RawHtml,
  linkRule
} from '@project-r/styleguide'

const { H2, P } = Interaction

class Poller extends Component {
  constructor (props) {
    super(props)
    const now = (new Date()).getTime()
    this.state = {
      now,
      start: now
    }
    this.tick = () => {
      clearTimeout(this.tickTimeout)
      this.tickTimeout = setTimeout(
        () => {
          this.setState(() => ({
            now: (new Date()).getTime()
          }))
          this.tick()
        },
        1000
      )
    }
  }
  componentDidMount () {
    this.props.data.startPolling(1000)
    this.tick()
  }
  componentDidUpdate () {
    const {data: {me}, onSuccess} = this.props
    if (me) {
      clearTimeout(this.tickTimeout)
      const elapsedMs = this.state.now - this.state.start
      this.props.data.stopPolling()

      onSuccess && onSuccess(me, elapsedMs)
    }
  }
  componentWillUnmount () {
    clearTimeout(this.tickTimeout)
  }
  render () {
    const { data: { error, me } } = this.props
    if (me) {
      return null
    }

    if (error) {
      return <ErrorMessage error={error} />
    }

    const {
      tokenType,
      email,
      onCancel,
      phrase,
      alternativeFirstFactors,
      onTokenTypeChange,
      t
    } = this.props

    return (<Fragment>
      <H2>{t(`signIn/polling/${tokenType}/title`)}</H2>
      <RawHtml
        type={P}
        dangerouslySetInnerHTML={{
          __html: t(`signIn/polling/${tokenType}/text`)
        }}
      />
      {!!onTokenTypeChange && alternativeFirstFactors.map(altTokenType => (
        <P key={altTokenType}>
          <a {...linkRule}
            href='#'
            onClick={(e) => {
              e.preventDefault()
              onTokenTypeChange(altTokenType)
            }}
          >
            {t(`signIn/polling/switch/${altTokenType}`)}
          </a>
        </P>
      ))}
      <P>
        <Label>{t('signIn/polling/phrase')}</Label><br />
        {phrase}
      </P>
      <P>
        <Label>{t('signIn/polling/email')}</Label><br />
        {email}
      </P>
      {!!onCancel && (
        <P>
          <a {...linkRule}
            href='#'
            onClick={(e) => {
              e.preventDefault()
              onCancel()
            }}
          >
            {t('signIn/polling/cancel')}
          </a>
        </P>
      )}
    </Fragment>)
  }
}

Poller.propTypes = {
  tokenType: PropTypes.oneOf(SUPPORTED_TOKEN_TYPES).isRequired,
  email: PropTypes.string.isRequired,
  phrase: PropTypes.string.isRequired,
  alternativeFirstFactors: PropTypes.arrayOf(
    PropTypes.oneOf(SUPPORTED_TOKEN_TYPES)
  ).isRequired,
  onSuccess: PropTypes.func,
  onCancel: PropTypes.func,
  onTokenTypeChange: PropTypes.func
}

Poller.defaultProps = {
  alternativeFirstFactors: []
}

export default compose(
  graphql(meQuery),
  withT
)(Poller)
